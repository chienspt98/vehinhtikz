import React, { useEffect, useRef } from "react";
import katex from "katex";

interface LatexElementProps {
  latex: string;
  displayMode: boolean;
}

export function LatexElement({ latex, displayMode }: LatexElementProps) {
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      try {
        katex.render(latex, containerRef.current, {
          displayMode,
          throwOnError: false,
          trust: true,
        });
      } catch (err) {
        // Fallback to raw text if KaTeX fails
        containerRef.current.textContent = latex;
      }
    }
  }, [latex, displayMode]);

  return <span ref={containerRef} className="math-element select-all" />;
}

interface MathTextProps {
  text: string;
}

export function MathText({ text }: MathTextProps) {
  if (!text) return null;

  // Split by block math $$ first
  const blockParts = text.split(/(\$\$[\s\S]*?\$\$)/g);

  return (
    <div className="space-y-4 text-gray-800 dark:text-gray-100 leading-relaxed font-sans text-sm md:text-base">
      {blockParts.map((part, index) => {
        if (part.startsWith("$$") && part.endsWith("$$")) {
          const formula = part.substring(2, part.length - 2).trim();
          return (
            <div 
              key={index} 
              className="overflow-x-auto py-4 my-3 flex justify-center bg-gray-50/80 dark:bg-zinc-800/80 border border-gray-100 dark:border-zinc-700/50 rounded-xl p-4 shadow-sm"
            >
              <LatexElement latex={formula} displayMode={true} />
            </div>
          );
        } else {
          // Inside non-block text, split by inline math $
          const inlineParts = part.split(/(\$[\s\S]*?\$)/g);
          return (
            <p key={index} className="inline-block w-full whitespace-pre-wrap">
              {inlineParts.map((subPart, subIndex) => {
                if (subPart.startsWith("$") && subPart.endsWith("$")) {
                  const formula = subPart.substring(1, subPart.length - 1).trim();
                  return (
                    <span key={subIndex} className="inline-block px-1 bg-indigo-50/30 dark:bg-indigo-950/20 rounded">
                      <LatexElement latex={formula} displayMode={false} />
                    </span>
                  );
                } else {
                  return <span key={subIndex}>{subPart}</span>;
                }
              })}
            </p>
          );
        }
      })}
    </div>
  );
}
