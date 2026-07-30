import React from "react";
import { PreviewTheme } from "../types";
import { LatexElement, MathText } from "./LatexRenderer";

interface MathCardPreviewProps {
  latex: string;
  theme: PreviewTheme;
  mode: 'formula' | 'explain' | 'tikz';
  fontSize: number; // custom font size control!
  tikzImageUrl?: string | null;
  isRenderingTikz?: boolean;
}

export function MathCardPreview({ latex, theme, mode, fontSize, tikzImageUrl, isRenderingTikz }: MathCardPreviewProps) {
  // Theme styling definitions
  const getThemeClasses = () => {
    switch (theme) {
      case 'grid':
        return {
          wrapper: "bg-[#faf9f6] text-zinc-900 border-zinc-200 shadow-lg relative",
          container: "relative overflow-hidden",
          // Grid background CSS
          style: {
            backgroundImage: "linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px)",
            backgroundSize: "20px 20px"
          },
          label: "text-zinc-400 font-mono text-xs border-zinc-200 border-b pb-1 mb-4 flex justify-between",
          tikzFilter: "mix-blend-multiply contrast-125" // multiply with off-white paper
        };
      case 'chalkboard':
        return {
          wrapper: "bg-[#1e3f20] text-zinc-50 border-emerald-800 shadow-xl border-4 rounded-xl",
          container: "relative overflow-hidden bg-radial from-[#224d25] to-[#163319] p-2",
          style: {
            textShadow: "0 0 1px rgba(255,255,255,0.4)"
          },
          label: "text-emerald-300 font-mono text-xs border-emerald-800 border-b pb-1 mb-4 flex justify-between",
          tikzFilter: "invert(1) brightness(1.5) contrast(150%) mix-blend-screen" // invert black-on-white TikZ to white chalk
        };
      case 'slate':
        return {
          wrapper: "bg-zinc-900 text-zinc-100 border-zinc-800 shadow-2xl rounded-xl",
          container: "relative overflow-hidden bg-gradient-to-br from-zinc-900 to-zinc-950 p-1",
          style: {},
          label: "text-zinc-500 font-mono text-xs border-zinc-800 border-b pb-1 mb-4 flex justify-between",
          tikzFilter: "invert(1) brightness(1.8) contrast(120%) mix-blend-screen" // white vector on black slate
        };
      case 'white':
      default:
        return {
          wrapper: "bg-white text-zinc-900 border-zinc-100 shadow-md",
          container: "relative overflow-hidden",
          style: {},
          label: "text-zinc-400 font-mono text-xs border-zinc-100 border-b pb-1 mb-4 flex justify-between",
          tikzFilter: "mix-blend-multiply" // multiply to blend white background
        };
    }
  };

  const themeConfig = getThemeClasses();

  const getModeLabel = () => {
    if (mode === 'formula') return 'FORMULA MODE';
    if (mode === 'explain') return 'EXPLANATION MODE';
    return 'TIKZ GRAPHICS';
  };

  return (
    <div 
      id="latex-preview-capture-box" 
      className={`p-8 rounded-xl border ${themeConfig.wrapper}`}
      style={{ ...themeConfig.style, fontSize: `${fontSize}px` }}
    >
      <div className={themeConfig.container}>
        {/* Card Header showing info */}
        <div className={themeConfig.label}>
          <span>LaTeX MATH CARD</span>
          <span>{getModeLabel()}</span>
        </div>

        {/* Math Output Content */}
        <div className="py-4 flex flex-col justify-center items-stretch min-h-[140px] select-all">
          {mode === 'formula' ? (
            <div className="flex justify-center py-6 overflow-x-auto">
              <LatexElement latex={latex || "f(x) = \\int_{-\\infty}^{\\infty} \\hat{f}(\\xi) e^{2\\pi i x \\xi} d\\xi"} displayMode={true} />
            </div>
          ) : mode === 'explain' ? (
            <div className="text-left w-full">
              <MathText text={latex || "Hãy nhập hoặc tải lên hình ảnh có công thức toán để xem lời giải chi tiết tại đây."} />
            </div>
          ) : (
            // Tikz preview block
            <div className="flex flex-col items-center justify-center py-4">
              {isRenderingTikz ? (
                <div className="flex flex-col items-center gap-3 text-sm text-zinc-400 py-8 animate-pulse">
                  <div className="w-8 h-8 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
                  <span>Đang vẽ đồ thị TikZ...</span>
                </div>
              ) : tikzImageUrl ? (
                <div className="flex justify-center items-center p-4 rounded-lg bg-transparent">
                  <img 
                    src={tikzImageUrl} 
                    alt="Compiled TikZ Diagram" 
                    className={`max-w-full max-h-[350px] object-contain transition-all duration-300`} 
                    style={{ filter: themeConfig.tikzFilter }}
                  />
                </div>
              ) : (
                <div className="text-center py-10 text-sm text-zinc-400 font-mono">
                  Chưa có hình ảnh TikZ được vẽ. Hãy nhấn "Biên dịch & Vẽ TikZ" dưới đây!
                </div>
              )}
            </div>
          )}
        </div>

        {/* Card Footer branding */}
        <div className="mt-6 pt-2 border-t border-dashed border-current opacity-40 text-[10px] flex justify-between">
          <span>Tạo bởi Image to LaTeX Converter</span>
          <span>{new Date().toLocaleDateString('vi-VN')}</span>
        </div>
      </div>
    </div>
  );
}
