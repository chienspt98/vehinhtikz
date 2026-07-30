import express from "express";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";

// List of forbidden non-LaTeX keywords and packages (pstricks, asymptote, xypic)
const FORBIDDEN_TIKZ_KEYWORDS = [
  "\\usepackage{pst-plot}",
  "\\usepackage{pstricks}",
  "\\usepackage{xypic}",
  "\\usepackage{asymptote}"
];

// Deduplicate repeated preamble lines like \usepackage{amsmath, amssymb}
function deduplicatePreamble(code: string): string {
  if (!code) return "";
  const lines = code.split("\n");
  const seenLines = new Set<string>();
  const resultLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (
      /^\\usepackage(\[.*?\])?\{.*?\}/.test(trimmed) ||
      /^\\usetikzlibrary\{.*?\}/.test(trimmed) ||
      /^\\pgfplotsset\{.*?\}/.test(trimmed)
    ) {
      const normalizedKey = trimmed.replace(/\s+/g, "");
      if (seenLines.has(normalizedKey)) {
        continue; // Skip duplicate preamble line
      }
      seenLines.add(normalizedKey);
    }
    resultLines.push(line);
  }

  return resultLines.join("\n");
}

// Ensure pdfLaTeX preamble contains standard support packages without duplication

function ensureVietnamesePreamble(code: string): string {
  if (!code) return "";
  let s = deduplicatePreamble(code);

  // Convert article to standalone for cropped preview images
  s = s.replace(/\\documentclass(\[.*?\])?\{article\}/gi, "\\documentclass[tikz,border=5mm]{standalone}");

  // Remove any T5 fontenc usage since compile servers lack t5enc.def
  s = s.replace(/\\usepackage\[[^\]]*T5[^\]]*\]\{fontenc\}/gi, "\\usepackage[T1]{fontenc}");

  // Remove babel package as it causes compilation errors in some environments
  s = s.replace(/\\usepackage(\[.*?\])?\{babel\}/gi, "");

  // Comment out custom local package files that aren't in TeXLive distribution
  s = s.replace(/\\usepackage\{ex_test\}/gi, "% \\usepackage{ex_test}");

  const inputencPkg = "\\usepackage[utf8]{inputenc}";
  const fontencPkg = "\\usepackage[T1]{fontenc}";
  const mathPkg = "\\usepackage{amsmath, amssymb, amsfonts, amsthm}\n\\usepackage{mathrsfs}";
  const xcolorPkg = "\\usepackage{xcolor}";
  const tikzPkg = "\\usepackage{tikz}";
  const tikzLibs = "\\usetikzlibrary{calc, angles, quotes, intersections, arrows, arrows.meta, positioning, 3d, perspective, decorations.pathreplacing, decorations.markings, decorations.pathmorphing, shapes.geometric, shapes.symbols, patterns, snakes}";
  const pgfplotsPkg = "\\usepackage{pgfplots}\n\\pgfplotsset{compat=1.18}";
  const tkzTabPkg = "\\usepackage{tkz-tab}";

  if (s.includes("\\documentclass")) {
    if (!/\\usepackage(\[.*?\])?\{[^}]*inputenc[^}]*\}/.test(s)) {
      s = s.replace(/(\\documentclass.*?\n)/, `$1${inputencPkg}\n`);
    }
    if (!/\\usepackage(\[.*?\])?\{[^}]*fontenc[^}]*\}/.test(s)) {
      s = s.replace(/(\\documentclass.*?\n)/, `$1${fontencPkg}\n`);
    }
    if (!/\\usepackage(\[.*?\])?\{[^}]*amsmath[^}]*\}/.test(s)) {
      s = s.replace(/(\\documentclass.*?\n)/, `$1${mathPkg}\n`);
    }
    if (!/\\usepackage(\[.*?\])?\{[^}]*xcolor[^}]*\}/.test(s)) {
      s = s.replace(/(\\documentclass.*?\n)/, `$1${xcolorPkg}\n`);
    }
    if (!/\\usepackage(\[.*?\])?\{[^}]*tikz[^}]*\}/.test(s)) {
      s = s.replace(/(\\documentclass.*?\n)/, `$1${tikzPkg}\n`);
    }
    if (!s.includes("\\usetikzlibrary")) {
      s = s.replace(/(\\begin\{document\})/, `${tikzLibs}\n$1`);
    }
    if (!/\\usepackage(\[.*?\])?\{[^}]*pgfplots[^}]*\}/.test(s)) {
      s = s.replace(/(\\begin\{document\})/, `${pgfplotsPkg}\n$1`);
    }
    if (!/\\usepackage(\[.*?\])?\{[^}]*tkz-tab[^}]*\}/.test(s)) {
      s = s.replace(/(\\begin\{document\})/, `${tkzTabPkg}\n$1`);
    }
  }

  return deduplicatePreamble(s);
}

// Auto-fix scope environment balance (ensure every \begin{scope} has matching \end{scope})
function fixScopeBalance(code: string): string {
  if (!code) return "";
  const begins = (code.match(/\\begin\{scope\}/g) || []).length;
  const ends = (code.match(/\\end\{scope\}/g) || []).length;
  
  if (begins > ends) {
    const missingCount = begins - ends;
    const closingScopes = "\n" + Array(missingCount).fill("\\end{scope}").join("\n");
    if (code.includes("\\end{tikzpicture}")) {
      code = code.replace("\\end{tikzpicture}", `${closingScopes}\n\\end{tikzpicture}`);
    } else if (code.includes("\\end{document}")) {
      code = code.replace("\\end{document}", `${closingScopes}\n\\end{document}`);
    } else {
      code += closingScopes;
    }
  }
  return code;
}

// Check TikZ code for forbidden keywords
function checkForbiddenPgfplotsKeywords(code: string): string[] {
  if (!code) return [];
  const found: string[] = [];
  for (const kw of FORBIDDEN_TIKZ_KEYWORDS) {
    if (code.includes(kw)) {
      found.push(kw);
    }
  }
  return found;
}

// Automatically convert any \begin{axis}[...] ... \end{axis} environment into pure TikZ \begin{scope} ... \end{scope}
function convertAxisToScope(code: string): string {
  if (!code || (!code.includes("\\begin{axis}") && !code.includes("\\addplot"))) return code;

  let s = code;

  // Regex to match \begin{axis}[opts] or \begin{axis}
  const axisRegex = /\\begin\{axis\}(?:\[([\s\S]*?)\])?/gi;

  s = s.replace(axisRegex, (match, opts) => {
    let xmin = "-4", xmax = "4", ymin = "-4", ymax = "4";
    if (opts) {
      const xminM = opts.match(/xmin\s*=\s*([-\d.]+)/i);
      const xmaxM = opts.match(/xmax\s*=\s*([-\d.]+)/i);
      const yminM = opts.match(/ymin\s*=\s*([-\d.]+)/i);
      const ymaxM = opts.match(/ymax\s*=\s*([-\d.]+)/i);
      if (xminM) xmin = xminM[1];
      if (xmaxM) xmax = xmaxM[1];
      if (yminM) ymin = yminM[1];
      if (ymaxM) ymax = ymaxM[1];
    }
    return `\\def\\xmin{${xmin}} \\def\\xmax{${xmax}}\n\\def\\ymin{${ymin}} \\def\\ymax{${ymax}}\n\\begin{scope}\n  \\clip (\\xmin,\\ymin) rectangle (\\xmax,\\ymax);\n  \\draw[->] (\\xmin,0)--(\\xmax,0) node[below]{$x$};\n  \\draw[->] (0,\\ymin)--(0,\\ymax) node[right]{$y$};\n  \\node[below right] at (0,0) {$O$};`;
  });

  // Replace \end{axis} with \end{scope}
  s = s.replace(/\\end\{axis\}/gi, "\\end{scope}");

  // Replace \addplot+? [opts] {expr};
  s = s.replace(/\\addplot\+?\s*(\[[^\]]*\])?\s*\{([^}]+)\}\s*;/gi, (m, opts, expr) => {
    const cleanOpts = opts ? opts.replace(/\[/g, "").replace(/\]/g, "") : "smooth, thick, blue!50!black";
    return `\\draw[${cleanOpts}] plot[domain=\\xmin:\\xmax, samples=200, variable=\\x] ({\\x}, {${expr}});`;
  });

  // Replace \addplot+? [opts] coordinates { ... };
  s = s.replace(/\\addplot\+?\s*(\[[^\]]*\])?\s*coordinates\s*\{([^}]+)\}\s*;/gi, (m, opts, coords) => {
    const cleanOpts = opts ? opts.replace(/\[/g, "").replace(/\]/g, "") : "thick, blue!50!black";
    const convertedCoords = coords.trim().replace(/\s+/g, " -- ");
    return `\\draw[${cleanOpts}] ${convertedCoords};`;
  });

  // Fallback replace any leftover \addplot with \draw
  s = s.replace(/\\addplot\+?\s*(\[[^\]]*\])?/gi, (m, opts) => {
    const cleanOpts = opts ? opts.replace(/\[/g, "").replace(/\]/g, "") : "smooth, thick, blue!50!black";
    return `\\draw[${cleanOpts}]`;
  });

  return s;
}

// Strip forbidden packages from document headers
function sanitizePureTikzHeader(code: string): string {
  if (!code) return "";
  let s = code;
  s = s.replace(/\\usepackage\{(pst-plot|pstricks|xypic|asymptote)\}/gi, "% ");
  return s;
}

// Helper to clean up any markdown code block wraps returned by LLM
function cleanLatex(input: string): string {
  if (!input) return "";
  let cleaned = input.trim();

  // 1. Strip markdown fences: ```latex, ```tikz, ```tex, ```
  cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/i, "").replace(/\n?```$/i, "").trim();
  cleaned = cleaned.replace(/```(latex|tikz|tex)?/gi, "").trim();

  // 1b. Convert any \begin{axis} environments to \begin{scope} (NO axis allowed in system)
  cleaned = convertAxisToScope(cleaned);

  // 2. Fix joined direction keys like belowleft -> below left
  cleaned = fixTikzDirectionKeys(cleaned);

  // 3. Fix invalid TikZ calc vector expressions like (C-B) -> ($(C)-(B)$)
  cleaned = fixTikzCalcVectors(cleaned);

  // 3. Fix trailing/leading spaces in \foreach \p/\pos in { ... } that break pgfkeys (e.g., 'above left ')
  cleaned = sanitizeTikzForeach(cleaned);

  // 3b. Auto-optimize multiple \pic right angle lines into a single \foreach loop
  cleaned = optimizeTikzAnglePicLines(cleaned);

  // 4. Fix coordinate mismatches (e.g. A_prime vs A')
  cleaned = sanitizeTikzCoordinates(cleaned);

  // 5. Remove blank lines inside tikzpicture to prevent \par errors
  cleaned = removeBlankLinesInTikz(cleaned);

  // 6. Remove forbidden packages from header
  cleaned = sanitizePureTikzHeader(cleaned);

  // 6. Ensure \begin{scope} balance
  cleaned = fixScopeBalance(cleaned);

  // 7. If output contains \documentclass, keep only from \documentclass to \end{document}
  const docClassIdx = cleaned.indexOf("\\documentclass");
  const endDocIdx = cleaned.lastIndexOf("\\end{document}");

  if (docClassIdx !== -1) {
    if (endDocIdx !== -1 && endDocIdx > docClassIdx) {
      cleaned = cleaned.substring(docClassIdx, endDocIdx + "\\end{document}".length);
    } else {
      cleaned = cleaned.substring(docClassIdx);
    }
  } else {
    // 8. If AI only returns \begin{tikzpicture}, wrap in standalone pure TikZ document with Vietnamese support
    const tikzStart = cleaned.indexOf("\\begin{tikzpicture}");
    const tikzEnd = cleaned.lastIndexOf("\\end{tikzpicture}");

    if (tikzStart !== -1) {
      let tikzBody = cleaned;
      if (tikzEnd !== -1 && tikzEnd > tikzStart) {
        tikzBody = cleaned.substring(tikzStart, tikzEnd + "\\end{tikzpicture}".length);
      } else {
        tikzBody = cleaned.substring(tikzStart) + "\n\\end{tikzpicture}";
      }
      cleaned = `\\documentclass[tikz,border=5mm]{standalone}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{amsmath, amssymb}
\\usepackage{tikz}
\\usetikzlibrary{calc, intersections, angles, quotes, patterns, arrows.meta, positioning, 3d}
\\usepackage{pgfplots}
\\pgfplotsset{compat=1.18}
\\usepackage{tkz-tab}
\\begin{document}
${tikzBody}
\\end{document}`;
    } else if (cleaned.trim().length > 0) {
      // 9. If AI returns raw TikZ commands, wrap in full doc + tikzpicture
      cleaned = `\\documentclass[tikz,border=5mm]{standalone}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{amsmath, amssymb}
\\usepackage{tikz}
\\usetikzlibrary{calc, intersections, angles, quotes, patterns, arrows.meta, positioning, 3d}
\\usepackage{pgfplots}
\\pgfplotsset{compat=1.18}
\\usepackage{tkz-tab}
\\begin{document}
\\begin{tikzpicture}
${cleaned}
\\end{tikzpicture}
\\end{document}`;
    }
  }

  // Ensure tikzpicture environment exists inside document if needed
  if (!cleaned.includes("\\begin{tikzpicture}") && !cleaned.includes("\\begin{axis}") && cleaned.includes("\\begin{document}")) {
    cleaned = cleaned.replace(
      "\\begin{document}",
      "\\begin{document}\n\\begin{tikzpicture}"
    );
  }
  if (!cleaned.includes("\\end{tikzpicture}") && !cleaned.includes("\\end{axis}") && cleaned.includes("\\end{document}")) {
    cleaned = cleaned.replace(
      "\\end{document}",
      "\\end{tikzpicture}\n\\end{document}"
    );
  }

  // Auto-fix any missing TikZ semicolons before compiling
  // const autoFixed = autoFixTikzSemicolons(cleaned);
  // cleaned = autoFixed.code;

  // Ensure Vietnamese preamble packages are added if missing
  cleaned = ensureVietnamesePreamble(cleaned);

  return cleaned.trim();
}

// Function pass-through
async function ensurePureTikzCode(
  aiClient: GoogleGenAI,
  code: string,
  retryCount = 0
): Promise<string> {
  return code;
}

// Auto-fix joined direction keys like belowleft -> below left, aboveleft -> above left, etc., and clean trailing spaces
function fixTikzDirectionKeys(code: string): string {
  if (!code) return "";
  let s = code;

  // 1. Unjoin squished keys (belowleft -> below left, etc.)
  s = s.replace(/\bbelowleft\b/gi, 'below left');
  s = s.replace(/\bbelowright\b/gi, 'below right');
  s = s.replace(/\baboveleft\b/gi, 'above left');
  s = s.replace(/\baboveright\b/gi, 'above right');

  // 2. Strip trailing spaces after two-word direction keys before delimiters like , ] : } /
  s = s.replace(/\b(above\s+left|above\s+right|below\s+left|below\s+right)\s+([,\]:}\/])/gi, '$1$2');

  // 3. Strip trailing spaces after single-word direction keys before delimiters, ensuring we don't touch the space in "above left"
  s = s.replace(/\b(above|below|left|right|midway|centered)\s+([,\]:}\/])/gi, '$1$2');

  return s;
}

// Auto-fix trailing/leading spaces in \foreach \p/\pos in { ... } that break pgfkeys (e.g., 'above left ')
function sanitizeTikzForeach(code: string): string {
  if (!code) return "";
  let s = fixTikzDirectionKeys(code);

  // Match \foreach ... in { ... } and trim item parts
  s = s.replace(/(\\foreach\s+[\s\S]*?\s+in\s*\{)([\s\S]*?)(\})/gi, (match, prefix, listContent, suffix) => {
    const cleanedList = listContent
      .split(',')
      .map((item: string) => {
        return item
          .split('/')
          .map((part: string) => part.trim())
          .join('/');
      })
      .join(', ');
    return `${prefix}${cleanedList}${suffix}`;
  });

  // Fix missing parentheses around loop variables used as coordinates: \fill[blue] \p circle -> \fill[blue] (\p) circle
  s = s.replace(/(?<!\(\s*)\\([a-zA-Z]+)\s+circle/g, '(\\$1) circle');

  // Fix "\node at \p" -> "\node at (\p)"
  s = s.replace(/\bat\s+\\([a-zA-Z]+)(\s*[{A-Za-z0-9])/g, 'at (\\$1)$2');

  return s;
}

// Auto-optimize consecutive \pic right angle / angle commands - disabled to avoid breaking TikZ angle key parsing
function optimizeTikzAnglePicLines(code: string): string {
  return code;
}

// Auto-fix coordinate mismatches (e.g. A_prime vs A') and missing prime shapes
function sanitizeTikzCoordinates(code: string): string {
  if (!code) return "";
  let s = code;

  // Extract all single-quote coordinate definitions/references like (A'), (B'), (C')
  const singleQuoteMatches = Array.from(s.matchAll(/\b([A-Za-z0-9]+)'\b/g)).map(m => m[1]);
  const singleQuoteCoords = new Set(singleQuoteMatches);

  // Extract all _prime coordinate definitions/references like (A_prime), (B_prime)
  const primeWordMatches = Array.from(s.matchAll(/\b([A-Za-z0-9]+)_prime\b/g)).map(m => m[1]);
  const primeWordCoords = new Set(primeWordMatches);

  // If (A') is used, replace any (A_prime) references with (A')
  singleQuoteCoords.forEach((name) => {
    const regex = new RegExp(`\\b${name}_prime\\b`, 'g');
    s = s.replace(regex, `${name}'`);
  });

  // If (A_prime) is defined but (A') wasn't used in definitions, normalize references
  primeWordCoords.forEach((name) => {
    if (!singleQuoteCoords.has(name)) {
      const regex = new RegExp(`\\b${name}'\\b`, 'g');
      s = s.replace(regex, `${name}_prime`);
    }
  });

  return s;
}

// Remove blank lines inside tikzpicture to prevent TeX \par errors inside TikZ factor parsers
function removeBlankLinesInTikz(code: string): string {
  if (!code) return "";
  return code.replace(/(\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\})/gi, (tikzBlock) => {
    return tikzBlock.replace(/\n\s*\n/g, '\n');
  });
}

// Auto-fix invalid coordinate math expressions like (C-B) or (A-D) inside calc ($ ... $)
function fixTikzCalcVectors(code: string): string {
  if (!code) return "";
  let s = code;

  // 1. Inside existing ($ ... $) blocks, fix invalid (C-B) or (A+B) syntax:
  s = s.replace(/\(\$\s*([\s\S]*?)\s*\$\)/g, (fullMatch, calcBody) => {
    const sanitizedBody = calcBody.replace(
      /\((@?[A-Za-z_][A-Za-z0-9_']*)[\s]*([+-])[\s]*(@?[A-Za-z_][A-Za-z0-9_']*)\)/g,
      '($1) $2 ($3)'
    );
    return `($ ${sanitizedBody} $)`;
  });

  // 2. Outside calc blocks, replace standalone (A-B) or (C-B) with ($ (C) - (B) $) if A and B are coordinate names
  s = s.replace(/(?<!\$\s*)\((@?[A-Za-z_][A-Za-z0-9_']*)[\s]*([+-])[\s]*(@?[A-Za-z_][A-Za-z0-9_']*)\)(?!\s*\$)/g, '($ ($1) $2 ($3) $)');

  return s;
}

// Automatic missing semicolon detection and auto-fixing (Section III & IV)
function autoFixTikzSemicolons(code: string): { code: string; fixed: boolean } {
  const lines = code.split("\n");
  let modified = false;

  const tikzCmdStartRegex = /^\s*\\(draw|path|node|fill|filldraw|shade|shadedraw|clip|coordinate)\b/;
  const blockStartRegex = /^\s*\\(begin|end|foreach)\b/;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip comment lines
    if (trimmed.startsWith("%")) {
      i++;
      continue;
    }

    if (tikzCmdStartRegex.test(trimmed)) {
      const cmdStartIdx = i;
      let j = i;
      let hasSemi = false;

      while (j < lines.length) {
        const curLine = lines[j];
        const curTrimmed = curLine.trim();

        if (curTrimmed.startsWith("%")) {
          j++;
          continue;
        }

        // Check if this line contains a semicolon ';'
        if (curLine.includes(";")) {
          hasSemi = true;
          break;
        }

        if (j > i) {
          // Stop if we hit the start of another TikZ command, block construct, or closing brace
          if (
            tikzCmdStartRegex.test(curTrimmed) ||
            blockStartRegex.test(curTrimmed) ||
            curTrimmed === "}" ||
            curTrimmed.startsWith("}")
          ) {
            break;
          }
        }

        j++;
      }

      if (!hasSemi) {
        // Find the last non-empty, non-comment line in range [cmdStartIdx, j - 1] to attach semicolon
        let targetLineIdx = -1;
        for (let k = j - 1; k >= cmdStartIdx; k--) {
          const tTrimmed = lines[k].trim();
          if (tTrimmed.length > 0 && !tTrimmed.startsWith("%")) {
            targetLineIdx = k;
            break;
          }
        }

        if (targetLineIdx !== -1) {
          const targetLine = lines[targetLineIdx];
          const commentIdx = targetLine.indexOf("%");
          if (commentIdx !== -1) {
            lines[targetLineIdx] = targetLine.slice(0, commentIdx).trimEnd() + ";" + targetLine.slice(commentIdx);
          } else {
            lines[targetLineIdx] = targetLine.trimEnd() + ";";
          }
          modified = true;
        }
      }

      i = Math.max(i + 1, j);
    } else {
      i++;
    }
  }

  return { code: lines.join("\n"), fixed: modified };
}

// Detailed error analysis helper
interface ErrorAnalysis {
  errorType: string;
  errorLine?: number;
  lineContent?: string;
  contextBefore: string[];
  contextAfter: string[];
  suspectedCommand?: string;
  suggestion: string;
  offendingChar?: string;
  rawLog: string;
}

function analyzeLatexErrorDetails(fullLatex: string, rawError: string): ErrorAnalysis {
  const lines = fullLatex.split("\n");
  
  let errorLineNumber: number | undefined;
  const lineMatch = rawError.match(/l\.(\d+)/) || rawError.match(/line\s+(\d+)/i);
  if (lineMatch) {
    errorLineNumber = parseInt(lineMatch[1], 10);
  }

  let lineContent = "";
  let contextBefore: string[] = [];
  let contextAfter: string[] = [];
  let suspectedCommand = "";
  let suggestion = "";
  let errorType = "LỖI BIÊN DỊCH LATEX";
  let offendingChar = "";

  if (errorLineNumber && errorLineNumber > 0 && errorLineNumber <= lines.length) {
    const zeroIdx = errorLineNumber - 1;
    lineContent = lines[zeroIdx] || "";
    
    const startBefore = Math.max(0, zeroIdx - 5);
    contextBefore = lines.slice(startBefore, zeroIdx);
    
    const endAfter = Math.min(lines.length, zeroIdx + 6);
    contextAfter = lines.slice(zeroIdx + 1, endAfter);

    const lookbackStart = Math.max(0, zeroIdx - 10);
    const lookbackLines = lines.slice(lookbackStart, zeroIdx + 1);
    
    const tikzKeywords = ["\\draw", "\\path", "\\node", "\\fill", "\\filldraw", "\\shade", "\\shadedraw", "\\clip", "\\coordinate", "\\foreach", "\\begin{scope}"];
    let suspectStartIndex = -1;
    for (let k = lookbackLines.length - 1; k >= 0; k--) {
      const lineText = lookbackLines[k].trim();
      if (tikzKeywords.some(kw => lineText.startsWith(kw))) {
        suspectStartIndex = lookbackStart + k;
        break;
      }
    }

    if (suspectStartIndex !== -1) {
      const endSlice = (lines[zeroIdx].trim() === "}" || lines[zeroIdx].trim().startsWith("}")) && zeroIdx > suspectStartIndex
        ? zeroIdx
        : zeroIdx + 1;
      suspectedCommand = lines.slice(suspectStartIndex, endSlice).join("\n");
    } else {
      suspectedCommand = lineContent;
    }
  }

  // Group 1: Vietnamese / Unicode Encoding Error
  const isUnicodeErr = 
    rawError.includes("Unicode character") ||
    rawError.includes("not set up for use with LaTeX") ||
    rawError.includes("Invalid UTF-8 byte") ||
    rawError.includes("inputenc Error");

  // Group 2: TikZ Semicolon Error (Only when log explicitly contains semicolon error)
  const isSemicolonErr = 
    rawError.includes("Giving up on this path") || 
    rawError.includes("Did you forget a semicolon");

  // Group 3: Undefined Control Sequence
  const isUndefinedCmdErr = rawError.includes("Undefined control sequence");

  // Group 4: Missing Package
  const isMissingPkgErr = rawError.includes(".sty' not found") || rawError.includes("File `");

  // Group 5: Environment or Brace Mismatch
  const isBraceEnvErr = 
    rawError.includes("Missing } inserted") || 
    rawError.includes("Extra }") || 
    rawError.includes("\\begin ended by \\end") || 
    (rawError.includes("Environment") && rawError.includes("undefined"));

  if (isUnicodeErr) {
    errorType = "LỖI MÃ HÓA TIẾNG VIỆT";
    const charMatch = rawError.match(/Unicode character\s+([^\s\(]+)/) || rawError.match(/Unicode character\s+([^\n]+)/);
    if (charMatch) {
      offendingChar = charMatch[1].trim();
    }
    suggestion = "Trình biên dịch pdfLaTeX chưa được cấu hình cho tiếng Việt. Hệ thống sẽ tự động bổ sung \\usepackage[T5]{fontenc}, \\usepackage[utf8]{inputenc} và \\usepackage{lmodern}.";
  } else if (isSemicolonErr) {
    errorType = "LỖI THIẾU DẤU CHẤM PHẨY TIKZ";
    if (errorLineNumber) {
      suggestion = `Lệnh TikZ gần dòng ${Math.max(1, errorLineNumber - 5)} hoặc tại dòng ${errorLineNumber} có thể chưa kết thúc bằng dấu ';'.`;
    } else {
      suggestion = "Có thể có lệnh TikZ chưa kết thúc bằng dấu ';'. Hãy kiểm tra các lệnh \\draw, \\node, \\fill hoặc \\foreach.";
    }
  } else if (isUndefinedCmdErr) {
    errorType = "LỖI LỆNH KHÔNG TỒN TẠI";
    suggestion = "Sử dụng lệnh hoặc tên gói LaTeX chưa được khai báo hoặc bị sai chính tả.";
  } else if (isMissingPkgErr) {
    errorType = "LỖI THIẾU PACKAGE LATEX";
    suggestion = "Máy chủ chưa cài đặt package cần thiết.";
  } else if (isBraceEnvErr) {
    errorType = "LỖI NGOẶC HOẶC MÔI TRƯỜNG LATEX";
    suggestion = "Dấu ngoặc nhọn {} không cân bằng hoặc môi trường TikZ/scope/foreach bị đóng sai cấu trúc.";
  } else {
    errorType = "LỖI BIÊN DỊCH LATEX";
    suggestion = "Vui lòng kiểm tra lại cú pháp TikZ hoặc nhấn 'AI sửa mã TikZ' để hệ thống tự động sửa lỗi.";
  }

  return {
    errorType,
    errorLine: errorLineNumber,
    lineContent,
    contextBefore,
    contextAfter,
    suspectedCommand: isUnicodeErr ? undefined : suspectedCommand,
    suggestion,
    offendingChar,
    rawLog: rawError
  };
}

export function createApiApp() {
  const app = express();

  // Vercel Functions have a 4.5 MB request/response payload limit.
  app.use(express.json({ limit: "4mb" }));
  app.use(express.urlencoded({ limit: "4mb", extended: true }));

  // API Route for converting math image or prompt to LaTeX/TikZ
  app.post("/api/convert-image", async (req: express.Request, res: express.Response) => {
    try {
      const { image, mimeType, mode, userPrompt, currentCode, apiKey: clientApiKey } = req.body;

      if (!image && !userPrompt) {
        return res.status(400).json({ error: "Vui lòng tải lên hình ảnh hoặc nhập yêu cầu cho AI." });
      }

      const headerApiKey = req.headers["x-gemini-key"];
      const activeApiKey =
        (typeof clientApiKey === "string" && clientApiKey.trim()) ||
        (typeof headerApiKey === "string" && headerApiKey.trim()) ||
        "";

      if (!activeApiKey) {
        return res.status(400).json({ error: "Chưa có Gemini API Key. Vui lòng vào Cài đặt để nhập API Key cá nhân." });
      }

      const aiClient = new GoogleGenAI({
        apiKey: activeApiKey as string,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const promptFormula = `Bạn là một chuyên gia OCR cao cấp về toán học và ký hiệu khoa học. Hãy phân tích hình ảnh này và chuyển đổi công thức toán học hoặc ký hiệu từ hình ảnh thành mã LaTeX chính xác nhất để hiển thị bằng KaTeX.
Quy tắc nghiêm ngặt:
1. CHỈ trả về mã LaTeX trực tiếp. KHÔNG bọc trong khối code Markdown (ví dụ: không có \`\`\`latex ... \`\`\` hoặc \`\`\` ... \`\`\`).
2. Trả về đúng công thức toán học tìm thấy. Đối với công thức lớn/trung tâm, hãy sử dụng $$ ... $$ để hiển thị dạng block, đối với công thức nội dòng hãy dùng $ ... $.
3. Tránh sử dụng các ký hiệu hoặc lệnh không được hỗ trợ bởi KaTeX chuẩn.
4. KHÔNG có văn bản giải thích nào khác ngoài mã LaTeX.`;

      const promptExplain = `Bạn là một chuyên gia toán học và giảng viên xuất sắc. Hãy quét hình ảnh này, chuyển đổi đề bài/công thức thành mã LaTeX, sau đó giải chi tiết từng bước.`;

      // A static URL lets Vercel's file tracer bundle this file with each Function.
      const promptTikzPath = new URL("./promptTikz.txt", import.meta.url);
      const promptTikz = fs.existsSync(promptTikzPath) ? fs.readFileSync(promptTikzPath, 'utf-8') : `Bạn là một chuyên gia hàng đầu về soạn thảo tài liệu toán học bằng LaTeX.`;


      let prompt = promptFormula;
      if (mode === "explain") {
        prompt = promptExplain;
      } else if (mode === "tikz") {
        prompt = promptTikz;
      }

      if (currentCode) {
        prompt += `\n\n[MÃ TIKZ HIỆN TẠI TRONG BỘ BIÊN DỊCH]:\n${currentCode}`;
      }

      if (userPrompt) {
        prompt += `\n\n[YÊU CẦU BỔ SUNG / YÊU CẦU CHỈNH SỬA TỪ NGUỜI DÙNG]:\n${userPrompt}`;
      }

      const parts: any[] = [];

      if (image) {
        parts.push({
          inlineData: {
            mimeType: mimeType || "image/png",
            data: image,
          },
        });
      }

      parts.push({
        text: prompt,
      });

      // Call Gemini API with precise temperature for geometry/TikZ
      const response = await aiClient.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts },
        config: {
          temperature: mode === "tikz" ? 0.1 : 0.3,
        }
      });

      const rawText = response.text || "";
      let cleanedText = cleanLatex(rawText);
      // const autoFixed = autoFixTikzSemicolons(cleanedText);
      // cleanedText = autoFixed.code;

      if (mode === "tikz") {
        cleanedText = await ensurePureTikzCode(aiClient, cleanedText);
      }

      res.json({ latex: cleanedText });
    } catch (error: any) {
      const errMsg = error?.message || error?.toString() || "";
      if (!errMsg.includes("429") && !errMsg.includes("RESOURCE_EXHAUSTED") && !errMsg.includes("Quota exceeded") && !errMsg.includes("quota")) {
        console.error("Error in convert-image:", error);
      }
      if (errMsg.includes("503") || errMsg.includes("UNAVAILABLE") || errMsg.includes("high demand")) {
        return res.status(503).json({
          error: "Hệ thống AI hiện đang quá tải (High demand). Vui lòng chờ ít phút và thử lại."
        });
      }
      if (errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("Quota exceeded") || errMsg.includes("quota")) {
        return res.status(429).json({
          error: "Đã vượt quá hạn ngạch (Quota) lượt gọi Gemini API miễn phí. Vui lòng chờ khoảng 30 giây - 1 phút rồi thử lại, hoặc nhập Gemini API Key cá nhân trong mục Cài đặt."
        });
      }
      if (errMsg.includes("API_KEY_INVALID") || errMsg.includes("API key not valid") || errMsg.includes("PERMISSION_DENIED")) {
        return res.status(401).json({
          error: "Gemini API Key không hợp lệ hoặc chưa được cấp quyền. Vui lòng kiểm tra lại key trong Cài đặt."
        });
      }
      res.status(500).json({ error: errMsg || "Đã xảy ra lỗi trên server." });
    }
  });

  // API Route for rendering TikZ LaTeX to PNG/PDF image
  app.post("/api/render-tikz", async (req: express.Request, res: express.Response) => {
    try {
      const { code } = req.body;
      if (!code) {
        return res.status(400).json({ error: "Thiếu mã nguồn TikZ." });
      }

      // Format full document if not already a standalone LaTeX document
      let fullLatex = cleanLatex(code);

      // Ensure Vietnamese support preamble is present for pdfLaTeX
      fullLatex = ensureVietnamesePreamble(fullLatex);

      // Remove non-standard package ex_test if present
      fullLatex = fullLatex.replace(/\\usepackage\{ex_test\}/g, "% $&");

      // Auto fix missing semicolons
      // const autoFixed = autoFixTikzSemicolons(fullLatex);
      // fullLatex = autoFixed.code;

      try {
        const result = await compileLatexToPdfOrPng(fullLatex);
        
        if (result.type === "png") {
          const base64Img = `data:image/png;base64,${result.buffer.toString("base64")}`;
          return res.json({ imageUrl: base64Img, latex: fullLatex });
        } else if (result.type === "svg") {
          const base64Svg = `data:image/svg+xml;base64,${result.buffer.toString("base64")}`;
          return res.json({ imageUrl: base64Svg, latex: fullLatex });
        } else {
          return res.json({ pdfBase64: result.buffer.toString("base64"), latex: fullLatex });
        }
      } catch (compileErr: any) {
        const rawErrLog = compileErr.message || compileErr.toString();
        const details = analyzeLatexErrorDetails(fullLatex, rawErrLog);
        return res.status(400).json({
          error: rawErrLog,
          details,
          latex: fullLatex
        });
      }
    } catch (error: any) {
      console.error("Error in render-tikz:", error.message || error);
      res.status(500).json({ error: error.message || "Không thể biên dịch hình vẽ TikZ." });
    }
  });

  // API Route for AI Fixing TikZ Code (Section XII)
  app.post("/api/fix-tikz", async (req: express.Request, res: express.Response) => {
    try {
      const { code, errorLog, errorLine, contextBefore, contextAfter, suspectedCommand, apiKey: clientApiKey } = req.body;

      if (!code) {
        return res.status(400).json({ error: "Thiếu mã TikZ cần sửa." });
      }

      const headerApiKey = req.headers["x-gemini-key"];
      const activeApiKey =
        (typeof clientApiKey === "string" && clientApiKey.trim()) ||
        (typeof headerApiKey === "string" && headerApiKey.trim()) ||
        "";
      if (!activeApiKey) {
        return res.status(400).json({ error: "Chưa có Gemini API Key. Vui lòng vào Cài đặt để nhập API Key cá nhân." });
      }

      const aiClient = new GoogleGenAI({
        apiKey: activeApiKey as string,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const fixPrompt = `Bạn là chuyên gia sửa lỗi cú pháp TikZ LaTeX hàng đầu.

[MÃ TIKZ CẦN SỬA]:
${code}

[LOG LỖI BIÊN DỊCH]:
${errorLog || 'Package tikz Error: Giving up on this path. Did you forget a semicolon?'}

${errorLine ? `[ĐỌAN BÁO LỖI]: Dòng ${errorLine}` : ''}
${suspectedCommand ? `[LỆNH TIKZ BỊ NGHI NGỜ]:\n${suspectedCommand}` : ''}

YÊU CẦU BẮT BỘC:
“Phân tích log lỗi và mã TikZ. Chỉ sửa tối thiểu các vị trí cần thiết. Không thay đổi hình học nếu không cần. Không giải thích. Chỉ trả về toàn bộ mã LaTeX hoàn chỉnh đã sửa. Kiểm tra kỹ dấu chấm phẩy, dấu ngoặc, foreach, node, label và môi trường TikZ trước khi trả lời.”

BẮT BỘC:
- Trả về TOÀN BỘ mã LaTeX độc lập hoàn chỉnh đã sửa.
- Tuyệt đối KHÔNG sử dụng Markdown code block (\`\`\`latex ... \`\`\`).
- Tuyệt đối KHÔNG giải thích hay chào hỏi.`;

      const response = await aiClient.models.generateContent({
        model: "gemini-2.5-flash",
        contents: fixPrompt,
        config: {
          temperature: 0.1,
        }
      });

      const rawFixText = response.text || "";
      if (!rawFixText.trim()) {
        return res.status(400).json({ error: "AI không trả về kết quả sửa mã. Giữ nguyên mã hiện tại." });
      }

      let cleanedFixed = cleanLatex(rawFixText);
      // const autoFixed = autoFixTikzSemicolons(cleanedFixed);
      // cleanedFixed = autoFixed.code;
      cleanedFixed = await ensurePureTikzCode(aiClient, cleanedFixed);

      try {
        const result = await compileLatexToPdfOrPng(cleanedFixed);

        let imageUrl = "";
        let pdfBase64 = "";

        if (result.type === "png") {
          imageUrl = `data:image/png;base64,${result.buffer.toString("base64")}`;
        } else if (result.type === "svg") {
          imageUrl = `data:image/svg+xml;base64,${result.buffer.toString("base64")}`;
        } else {
          pdfBase64 = result.buffer.toString("base64");
        }

        return res.json({
          success: true,
          latex: cleanedFixed,
          imageUrl,
          pdfBase64
        });
      } catch (compileErr: any) {
        const rawErrLog = compileErr.message || compileErr.toString();
        const details = analyzeLatexErrorDetails(cleanedFixed, rawErrLog);
        return res.status(400).json({
          error: "Sửa AI hoàn tất nhưng biên dịch vẫn báo lỗi: " + rawErrLog,
          latex: cleanedFixed,
          details
        });
      }

    } catch (error: any) {
      const errMsg = error?.message || error?.toString() || "";
      if (!errMsg.includes("429") && !errMsg.includes("RESOURCE_EXHAUSTED") && !errMsg.includes("Quota exceeded") && !errMsg.includes("quota")) {
        console.error("Error in fix-tikz:", error);
      }
      // Use the errMsg already defined
      if (errMsg.includes("503") || errMsg.includes("UNAVAILABLE") || errMsg.includes("high demand")) {
        return res.status(503).json({
          error: "Hệ thống AI hiện đang quá tải (High demand). Vui lòng chờ ít phút và thử lại."
        });
      }
      if (errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("Quota exceeded") || errMsg.includes("quota")) {
        return res.status(429).json({
          error: "Đã vượt quá hạn ngạch (Quota) lượt gọi Gemini API miễn phí. Vui lòng chờ khoảng 30 giây - 1 phút rồi thử lại, hoặc nhập Gemini API Key cá nhân trong mục Cài đặt."
        });
      }
      if (errMsg.includes("API_KEY_INVALID") || errMsg.includes("API key not valid") || errMsg.includes("PERMISSION_DENIED")) {
        return res.status(401).json({
          error: "Gemini API Key không hợp lệ hoặc chưa được cấp quyền. Vui lòng kiểm tra lại key trong Cài đặt."
        });
      }
      res.status(500).json({ error: errMsg || "Không thể tự động sửa mã TikZ." });
    }
  });

async function compileLatexToPdfOrPng(fullLatex: string): Promise<{ buffer: Buffer; type: "pdf" | "png" | "svg" }> {
  let lastErrorMsg = "";

  // Helper to sanitize HTML error messages
  const cleanErrorMessage = (raw: string) => {
    if (!raw) return "";
    if (raw.includes("<!DOCTYPE") || raw.includes("<html") || raw.includes("<title>")) {
      return "Dịch vụ biên dịch trực tuyến phản hồi lỗi HTML / quá tải";
    }
    let text = raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const logLines = text.split("\n").filter(l => l.includes("Error") || l.includes("error") || l.startsWith("!"));
    if (logLines.length > 0) {
      return logLines.slice(0, 2).join(" ");
    }
    return text.slice(0, 160);
  };

  // Extract tikzpicture block if present for fallback
  let tikzBodyOnly = fullLatex;
  const tikzMatch = fullLatex.match(/(\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\})/);
  if (tikzMatch) {
    tikzBodyOnly = tikzMatch[1];
  }

  // Strategy 1: Kroki.io PNG (High reliability & fast TikZ compiler)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    const krokiRes = await fetch("https://kroki.io/tikz/png", {
      method: "POST",
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: fullLatex,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (krokiRes.ok) {
      const arrayBuffer = await krokiRes.arrayBuffer();
      const buf = Buffer.from(arrayBuffer);
      if (buf.length > 200) {
        return { buffer: buf, type: "png" };
      }
    } else {
      const errText = await krokiRes.text().catch(() => "");
      if (errText) lastErrorMsg = cleanErrorMessage(errText);
    }
  } catch (err: any) {
    // Kroki PNG failed or timed out, try next strategy
  }

  // Strategy 2: Kroki.io SVG (High quality vector output with full document or tikzBodyOnly)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    const krokiSvgRes = await fetch("https://kroki.io/tikz/svg", {
      method: "POST",
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: tikzBodyOnly,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (krokiSvgRes.ok) {
      const arrayBuffer = await krokiSvgRes.arrayBuffer();
      const buf = Buffer.from(arrayBuffer);
      if (buf.length > 200) {
        return { buffer: buf, type: "svg" };
      }
    }
  } catch (err: any) {
    // try next
  }

  // Strategy 3: rtex.org service fallback
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 18000);

    const buildRes = await fetch("https://rtex.org/api/v1/build", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: fullLatex, format: "pdf" }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (buildRes.ok) {
      const json = await buildRes.json();
      if (json.status === "success" && json.filename) {
        const getRes = await fetch(`https://rtex.org/api/v1/get?filename=${json.filename}`);
        if (getRes.ok) {
          const arrayBuffer = await getRes.arrayBuffer();
          return { buffer: Buffer.from(arrayBuffer), type: "pdf" };
        }
      } else if (json.log) {
        const cleanLog = cleanErrorMessage(json.log);
        if (cleanLog) lastErrorMsg = cleanLog;
      }
    }
  } catch (err: any) {
    // ignore
  }

  // Strategy 4: QuickLatex API
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const preamble = `\\usepackage{amsmath,amssymb}\\usepackage{tikz}\\usetikzlibrary{calc,intersections,angles,quotes,patterns,arrows.meta,positioning,3d}`;
    
    let innerFormula = fullLatex;
    if (fullLatex.includes("\\begin{document}")) {
      const matchDoc = fullLatex.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/);
      if (matchDoc) {
        innerFormula = matchDoc[1].trim();
      }
    }

    const params = new URLSearchParams();
    params.append("formula", innerFormula);
    params.append("preamble", preamble);
    params.append("fsize", "19px");
    params.append("fcolor", "000000");
    params.append("mode", "0");
    params.append("out", "1");
    params.append("removespaces", "1");

    const qRes = await fetch("https://www.quicklatex.com/latex3.f", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (qRes.ok) {
      const text = await qRes.text();
      const lines = text.trim().split("\n");
      const imgUrl = lines.find((l) => l.trim().startsWith("http"));
      if (imgUrl) {
        const imgRes = await fetch(imgUrl.trim());
        if (imgRes.ok) {
          const arrayBuf = await imgRes.arrayBuffer();
          return { buffer: Buffer.from(arrayBuf), type: "png" };
        }
      } else if (lines[1]) {
        lastErrorMsg = cleanErrorMessage(lines[1]);
      }
    }
  } catch (err: any) {
    // ignore
  }

  // Strategy 5: latexonline.cc POST request
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const body = new URLSearchParams();
    body.append("text", fullLatex);

    const res = await fetch("https://latexonline.cc/compile", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/pdf")) {
        const arrayBuffer = await res.arrayBuffer();
        return { buffer: Buffer.from(arrayBuffer), type: "pdf" };
      }
    }
  } catch (err: any) {
    // ignore
  }

  throw new Error(
    lastErrorMsg
      ? `Không thể biên dịch TikZ. Chi tiết: ${lastErrorMsg}`
      : "Dịch vụ biên dịch trực tuyến đang quá tải hoặc gặp sự cố. Vui lòng kiểm tra lại mã TikZ hoặc nhấn Biên dịch lại."
  );
}

  return app;
}

const app = createApiApp();

export default app;
