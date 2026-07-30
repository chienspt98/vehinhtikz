import React, { useState, useEffect, useRef } from "react";
import { 
  Upload, 
  Image as ImageIcon, 
  Copy, 
  Check, 
  Sparkles, 
  RefreshCw, 
  Download, 
  History, 
  Trash2, 
  HelpCircle, 
  FileCode, 
  CheckCircle, 
  Settings,
  Code,
  FileText,
  AlertTriangle,
  ExternalLink,
  BarChart3,
  X,
  Key,
  Send,
  MessageSquare,
  Bot,
  User,
  Wand2,
  Bug,
  RotateCcw,
  AlertCircle
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import { SampleItem, HistoryItem } from "./types";

interface TikzErrorDetails {
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

const MAX_API_IMAGE_BASE64_LENGTH = 2_800_000;
const MAX_API_REQUEST_BYTES = 4_000_000;

async function prepareImageForApi(
  dataUrl: string,
  fallbackMimeType: string
): Promise<{ base64: string; mimeType: string }> {
  const commaIndex = dataUrl.indexOf(",");
  const header = commaIndex >= 0 ? dataUrl.slice(0, commaIndex) : "";
  const payload = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
  const mimeMatch = header.match(/^data:([^;,]+)/i);
  const detectedMimeType = mimeMatch?.[1] || fallbackMimeType || "image/png";
  const isBase64 = /;base64/i.test(header);

  if (isBase64 && payload.length <= MAX_API_IMAGE_BASE64_LENGTH) {
    return { base64: payload, mimeType: detectedMimeType };
  }

  const sourceImage = new window.Image();
  sourceImage.decoding = "async";
  sourceImage.src = dataUrl;
  await new Promise<void>((resolve, reject) => {
    sourceImage.onload = () => resolve();
    sourceImage.onerror = () => reject(new Error("Không thể tối ưu ảnh trước khi gửi lên máy chủ."));
  });

  const initialScale = Math.min(
    1,
    2048 / Math.max(sourceImage.naturalWidth, sourceImage.naturalHeight)
  );
  let width = Math.max(1, Math.round(sourceImage.naturalWidth * initialScale));
  let height = Math.max(1, Math.round(sourceImage.naturalHeight * initialScale));
  let result = "";

  for (let attempt = 0; attempt < 7; attempt++) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Không thể tạo canvas để tối ưu ảnh.");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(sourceImage, 0, 0, width, height);

    const quality = Math.max(0.55, 0.92 - attempt * 0.06);
    result = canvas.toDataURL("image/jpeg", quality).split(",")[1] || "";
    if (result.length <= MAX_API_IMAGE_BASE64_LENGTH) {
      break;
    }

    if (Math.max(width, height) > 720) {
      width = Math.max(1, Math.round(width * 0.82));
      height = Math.max(1, Math.round(height * 0.82));
    }
  }

  if (!result || result.length > MAX_API_IMAGE_BASE64_LENGTH) {
    throw new Error("Ảnh quá lớn để gửi lên Vercel. Vui lòng cắt gọn ảnh rồi thử lại.");
  }

  return { base64: result, mimeType: "image/jpeg" };
}

// Setup PDFJS worker from official unpkg CDN
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

// TeXstudio Logo Component
const TexStudioLogo = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="6" width="60" height="52" rx="8" fill="#1A5FB4" />
    <path d="M10 14H54V50H10V14Z" fill="#3584E4" rx="4" />
    <text x="12" y="38" fontFamily="Georgia, serif" fontWeight="900" fontSize="20" fill="#FFFFFF" letterSpacing="-1">TeX</text>
    <path d="M42 42L54 26L48 20L36 36V42H42Z" fill="#E66100" />
    <path d="M48 20L51.5 16.5C52.5 15.5 54 15.5 55 16.5L56.5 18C57.5 19 57.5 20.5 56.5 21.5L53 25L48 20Z" fill="#F6D32D" />
  </svg>
);

// Preset TikZ Geometric Drawing Samples
const SAMPLE_TIKZ: SampleItem[] = [
  {
    id: "tikz-triangle",
    name: "Tam giác vuông SGK",
    description: "Tam giác vuông có nhãn góc A, B, C và độ dài các cạnh",
    latex: `\\begin{tikzpicture}[scale=1.2]
  \\draw[thick] (0,0) coordinate (A) -- (4,0) coordinate (B) -- (4,3) coordinate (C) -- (0,0);
  \\draw (4,0.3) -- (3.7,0.3) -- (3.7,0);
  \\node[below left] at (A) {$A$};
  \\node[below right] at (B) {$B$};
  \\node[above right] at (C) {$C$};
  \\node[above left] at (2,1.5) {$5\\text{ cm}$};
  \\node[below] at (2,0) {$4\\text{ cm}$};
  \\node[right] at (4,1.5) {$3\\text{ cm}$};
\\end{tikzpicture}`,
    svgIcon: `<svg viewBox="0 0 100 40" class="w-full h-full stroke-blue-600 fill-none" stroke-width="2"><path d="M15 32 L85 32 L85 8 Z" /><path d="M79 32 L79 26 L85 26" /></svg>`
  },
  {
    id: "tikz-parabol",
    name: "Đồ thị Parabol Oxy",
    description: "Hàm số y = x² nét vẽ chuẩn Toán lớp 9-10",
    latex: `\\begin{tikzpicture}[scale=0.8]
  \\draw[->, thick] (-3,0) -- (3,0) node[right] {$x$};
  \\draw[->, thick] (0,-1) -- (0,5) node[above] {$y$};
  \\draw[domain=-2:2,smooth,variable=\\x,blue,very thick] plot ({\\x},{\\x*\\x});
  \\node[below left] at (0,0) {$O$};
  \\draw[dashed] (1,0) -- (1,1) -- (0,1);
  \\node[below] at (1,0) {$1$};
  \\node[left] at (0,1) {$1$};
\\end{tikzpicture}`,
    svgIcon: `<svg viewBox="0 0 100 40" class="w-full h-full stroke-blue-600 fill-none" stroke-width="2"><path d="M50 35 L50 5 M10 20 L90 20" stroke-dasharray="1 2"/><path d="M25 10 Q50 35 75 10" /></svg>`
  },
  {
    id: "tikz-venn",
    name: "Sơ đồ tập hợp Venn",
    description: "Giao của hai tập hợp toán học",
    latex: `\\begin{tikzpicture}
  \\draw[thick, fill=blue!20, opacity=0.7] (0,0) circle (1.1) node[left=0.5cm, opacity=1] {$A$};
  \\draw[thick, fill=cyan!20, opacity=0.7] (1.3,0) circle (1.1) node[right=0.5cm, opacity=1] {$B$};
  \\node at (0.65, 0) {$A \\cap B$};
\\end{tikzpicture}`,
    svgIcon: `<svg viewBox="0 0 100 40" class="w-full h-full stroke-blue-600 fill-none" stroke-width="2"><circle cx="40" cy="20" r="14" fill="currentColor" fill-opacity="0.15"/><circle cx="60" cy="20" r="14" fill="currentColor" fill-opacity="0.15"/></svg>`
  }
];

export default function App() {
  // Navigation & Tabs
  const [rightTab, setRightTab] = useState<'render' | 'code'>('render');

  // Input File & Image State
  const [image, setImage] = useState<string | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("image/png");
  
  // Chat Prompt State
  const [userPrompt, setUserPrompt] = useState<string>("");
  const [chatMessages, setChatMessages] = useState<
    { id: string; sender: 'user' | 'ai'; text: string; timestamp: string }[]
  >([
    {
      id: "welcome",
      sender: "ai",
      text: "Xin chào Thầy! Thầy có thể tải ảnh đề bài lên hoặc gõ trực tiếp yêu cầu vẽ hình toán học (ví dụ: 'Vẽ hình chóp S.ABCD', 'Vẽ tam giác vuông', 'Sửa hình hiện tại thêm nét đứt'). AI sẽ tự động tạo và biên dịch mã TikZ cho Thầy!",
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  
  // OCR & TikZ Compilation States
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [latexCode, setLatexCode] = useState<string>(
    `\\documentclass[tikz,border=5pt]{standalone}\n\\usepackage{tikz}\n\\begin{document}\n\\begin{tikzpicture}\n  \\coordinate (A) at (0,0);\n  \\coordinate (B) at (2,3);\n  \\coordinate (C) at (4,0);\n  \\draw[thick, blue] (A) -- (B) -- (C) -- cycle;\n  \\foreach \\t/\\g in {A/225, B/90, C/-45}{\n    \\draw[line width=0.6pt] (\\t) circle (0.4pt) node[shift={(\\g:9pt)}, font=\\normalsize]{$\\t$};\n  }\n\\end{tikzpicture}\n\\end{document}`
  );
  const [tikzImageUrl, setTikzImageUrl] = useState<string | null>(null);
  const [isRenderingTikz, setIsRenderingTikz] = useState<boolean>(false);
  
  // AI Fix & Detailed Error Diagnostic States
  const [tikzErrorDetails, setTikzErrorDetails] = useState<TikzErrorDetails | null>(null);
  const [isAiFixing, setIsAiFixing] = useState<boolean>(false);
  const [previousLatexCode, setPreviousLatexCode] = useState<string | null>(null);
  
  // Global & Modals
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [geminiApiKey, setGeminiApiKey] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load saved history & preferences on mount
  useEffect(() => {
    const saved = localStorage.getItem("latex_converter_history");
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
    const savedKey = localStorage.getItem("gemini_api_key");
    if (savedKey) {
      setGeminiApiKey(savedKey);
    }
  }, []);

  // Clipboard paste listener (Ctrl+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            handleImageFile(file);
          }
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  // Trigger TikZ PDF compilation via server proxy
  const handleRenderTikz = async (codeToRender = latexCode) => {
    if (!codeToRender) return;
    setIsRenderingTikz(true);
    setErrorMessage(null);
    setTikzErrorDetails(null);

    try {
      const response = await fetch("/api/render-tikz", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: codeToRender }),
      });

      let responseData;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        responseData = await response.json();
      } else {
        const text = await response.text();
        throw new Error(`Phản hồi từ server: ${text.slice(0, 100)}`);
      }

      if (responseData.latex && responseData.latex !== latexCode) {
        setLatexCode(responseData.latex);
      }

      if (!response.ok) {
        if (responseData.details) {
          setTikzErrorDetails(responseData.details);
        }
        throw new Error(responseData.error || "Không thể biên dịch mã TikZ.");
      }

      if (responseData.pdfBase64) {
        // Render PDF base64 to client canvas image
        const binaryString = atob(responseData.pdfBase64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const pdf = await pdfjsLib.getDocument({ data: bytes.buffer }).promise;
        const page = await pdf.getPage(1);
        
        const viewport = page.getViewport({ scale: 2.5 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (!context) {
          throw new Error("Không thể tạo canvas context.");
        }

        await page.render({ canvasContext: context, viewport, canvas }).promise;
        const pngDataUrl = canvas.toDataURL("image/png");
        setTikzImageUrl(pngDataUrl);
      } else if (responseData.imageUrl) {
        setTikzImageUrl(responseData.imageUrl);
      } else {
        throw new Error("Không nhận được dữ liệu hình ảnh.");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Lỗi biên dịch TikZ.");
    } finally {
      setIsRenderingTikz(false);
    }
  };

  // AI Automatic TikZ Code Fixing Handler (Section XII)
  const handleAiFixTikz = async () => {
    if (!latexCode) return;
    if (!geminiApiKey.trim()) {
      setErrorMessage("Vui lòng nhập Gemini API Key cá nhân trong Cài đặt trước khi dùng AI sửa mã.");
      setShowSettingsModal(true);
      return;
    }
    setIsAiFixing(true);
    setPreviousLatexCode(latexCode);

    try {
      const response = await fetch("/api/fix-tikz", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: latexCode,
          errorLog: tikzErrorDetails?.rawLog || errorMessage,
          errorLine: tikzErrorDetails?.errorLine,
          contextBefore: tikzErrorDetails?.contextBefore,
          contextAfter: tikzErrorDetails?.contextAfter,
          suspectedCommand: tikzErrorDetails?.suspectedCommand,
          apiKey: geminiApiKey.trim() || undefined,
        }),
      });

      let responseData;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        responseData = await response.json();
      } else {
        const text = await response.text();
        throw new Error(`Phản hồi từ server: ${text.slice(0, 100)}`);
      }

      if (!response.ok) {
        if (responseData.latex) {
          setLatexCode(responseData.latex);
        }
        if (responseData.details) {
          setTikzErrorDetails(responseData.details);
        }
        throw new Error(responseData.error || "AI chưa thể tự động sửa lỗi này.");
      }

      if (responseData.latex) {
        setLatexCode(responseData.latex);
        saveToHistory(responseData.latex);
      }

      if (responseData.pdfBase64) {
        const binaryString = atob(responseData.pdfBase64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const pdf = await pdfjsLib.getDocument({ data: bytes.buffer }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 2.5 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (context) {
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          await page.render({ canvasContext: context, viewport, canvas }).promise;
          setTikzImageUrl(canvas.toDataURL("image/png"));
        }
      } else if (responseData.imageUrl) {
        setTikzImageUrl(responseData.imageUrl);
      }

      setTikzErrorDetails(null);
      setErrorMessage(null);

      setChatMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(7),
          sender: 'ai',
          text: 'AI đã tự động phân tích log lỗi, sửa lại cú pháp TikZ và biên dịch thành công!',
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        }
      ]);

    } catch (err: any) {
      console.error(err);
      setErrorMessage("Lỗi AI sửa mã: " + err.message);
    } finally {
      setIsAiFixing(false);
    }
  };

  const handleUndoAiFix = () => {
    if (previousLatexCode) {
      setLatexCode(previousLatexCode);
      setPreviousLatexCode(null);
      handleRenderTikz(previousLatexCode);
    }
  };

  const saveToHistory = (latex: string) => {
    const newItem: HistoryItem = {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      latex,
      mode: 'tikz',
      imageUrl: image || undefined
    };
    const updated = [newItem, ...history.slice(0, 9)];
    setHistory(updated);
    localStorage.setItem("latex_converter_history", JSON.stringify(updated));
  };

  // File Handlers
  const handleImageFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setErrorMessage("Vui lòng tải lên định dạng tệp hình ảnh hợp lệ (PNG, JPG, WEBP).");
      return;
    }
    setMimeType(file.type);
    setPdfFileName(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setImage(e.target.result as string);
        setErrorMessage(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePdfFile = async (file: File) => {
    setIsConverting(true);
    setErrorMessage(null);
    setPdfFileName(file.name);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      if (pdf.numPages === 0) {
        throw new Error("Tệp PDF này không có trang nào.");
      }

      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 2.0 });

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Không thể khởi tạo Canvas.");

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: context, viewport, canvas }).promise;

      const dataUrl = canvas.toDataURL("image/png");
      setImage(dataUrl);
      setMimeType("image/png");
      setErrorMessage(null);
    } catch (err: any) {
      console.error("PDF error:", err);
      setErrorMessage("Lỗi nạp tệp PDF: " + (err.message || err));
    } finally {
      setIsConverting(false);
    }
  };

  const handleUploadedFile = (file: File) => {
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      handlePdfFile(file);
    } else {
      handleImageFile(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUploadedFile(e.dataTransfer.files[0]);
    }
  };

  const handleClear = () => {
    setImage(null);
    setPdfFileName(null);
    setLatexCode("");
    setTikzImageUrl(null);
    setErrorMessage(null);
    setUserPrompt("");
    setChatMessages([
      {
        id: "welcome",
        sender: "ai",
        text: "Xin chào Thầy! Thầy có thể tải ảnh đề bài lên hoặc gõ trực tiếp yêu cầu vẽ hình toán học. AI sẽ tự động tạo và biên dịch mã TikZ cho Thầy!",
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  // Convert uploaded image or user prompt to TikZ code using Gemini
  const handleConvert = async (customPrompt?: string) => {
    const promptToUse = typeof customPrompt === 'string' ? customPrompt : userPrompt;
    
    if (!image && !promptToUse.trim()) {
      setErrorMessage("Vui lòng tải lên hình ảnh đề bài hoặc nhập yêu cầu cho AI.");
      return;
    }
    if (!geminiApiKey.trim()) {
      setErrorMessage("Vui lòng nhập Gemini API Key cá nhân trong Cài đặt trước khi chuyển ảnh.");
      setShowSettingsModal(true);
      return;
    }

    setIsConverting(true);
    setErrorMessage(null);
    setTikzImageUrl(null);

    const timeStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    if (promptToUse.trim()) {
      setChatMessages((prev) => [
        ...prev,
        { id: Math.random().toString(36).substring(7), sender: 'user', text: promptToUse.trim(), timestamp: timeStr }
      ]);
    }

    try {
      const preparedImage = image
        ? await prepareImageForApi(image, mimeType)
        : undefined;
      const requestBody = JSON.stringify({
        image: preparedImage?.base64,
        mimeType: preparedImage?.mimeType,
        mode: 'tikz',
        userPrompt: promptToUse.trim() || undefined,
        currentCode: latexCode || undefined,
        apiKey: geminiApiKey.trim(),
      });

      if (new TextEncoder().encode(requestBody).byteLength > MAX_API_REQUEST_BYTES) {
        throw new Error("Dữ liệu gửi lên quá lớn. Vui lòng cắt gọn ảnh hoặc rút ngắn mã TikZ hiện tại.");
      }

      const response = await fetch("/api/convert-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: requestBody,
      });

      let responseData;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        responseData = await response.json();
      } else {
        const text = await response.text();
        throw new Error(`Phản hồi từ máy chủ (${response.status}): ${text.slice(0, 100)}`);
      }

      if (!response.ok) {
        throw new Error(responseData.error || "Gặp lỗi trong quá trình xử lý.");
      }

      if (responseData.latex) {
        setLatexCode(responseData.latex);
        saveToHistory(responseData.latex);
        handleRenderTikz(responseData.latex);
        
        setChatMessages((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).substring(7),
            sender: 'ai',
            text: 'Đã hoàn thành và tự động biên dịch mã TikZ theo yêu cầu của Thầy!',
            timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
          }
        ]);
        setUserPrompt('');
      } else {
        throw new Error("Không nhận được mã TikZ.");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Đã xảy ra lỗi khi xử lý.");
    } finally {
      setIsConverting(false);
    }
  };

  const handleLoadSample = (sample: SampleItem, isTikz = true) => {
    setLatexCode(sample.latex);
    setTikzImageUrl(null);
    handleRenderTikz(sample.latex);
    const mockDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(sample.svgIcon)}`;
    setImage(mockDataUrl);
    setMimeType("image/svg+xml");
    setPdfFileName(null);
    setErrorMessage(null);
  };

  const handleExportImage = (format: 'png') => {
    if (tikzImageUrl) {
      const link = document.createElement('a');
      link.download = `tqh-chart-${Date.now()}.${format}`;
      link.href = tikzImageUrl;
      link.click();
    }
  };

  const handleExportTex = () => {
    let fullTex = latexCode.trim();
    if (!fullTex.includes("\\documentclass")) {
      fullTex = `\\documentclass[tikz,border=5mm]{standalone}
\\usepackage[utf8]{inputenc}
\\usepackage[T5,T1]{fontenc}
\\usepackage{amsmath, amssymb, amsfonts, amsthm}
\\usepackage{mathrsfs}
\\usepackage{xcolor}
\\usepackage{tikz}
\\usepackage{pgfplots}
\\pgfplotsset{compat=1.18}
\\usetikzlibrary{calc, angles, quotes, intersections, arrows.meta, shapes.geometric, patterns, snakes, 3d, perspective}
\\usepackage{tkz-tab}
\\begin{document}
${fullTex}
\\end{document}`;
    }

    const blob = new Blob([fullTex], { type: "text/x-tex;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tqh-chart-${Date.now()}.tex`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenInOverleaf = () => {
    let fullTex = latexCode.trim();
    if (!fullTex.includes("\\documentclass")) {
      fullTex = `\\documentclass[tikz,border=5mm]{standalone}
\\usepackage[utf8]{inputenc}
\\usepackage[T5,T1]{fontenc}
\\usepackage{amsmath, amssymb, amsfonts, amsthm}
\\usepackage{mathrsfs}
\\usepackage{xcolor}
\\usepackage{tikz}
\\usepackage{pgfplots}
\\pgfplotsset{compat=1.18}
\\usetikzlibrary{calc, angles, quotes, intersections, arrows.meta, shapes.geometric, patterns, snakes, 3d, perspective}
\\usepackage{tkz-tab}
\\begin{document}
${fullTex}
\\end{document}`;
    }

    const form = document.createElement("form");
    form.method = "POST";
    form.action = "https://www.overleaf.com/docs";
    form.target = "_blank";

    const textarea = document.createElement("textarea");
    textarea.name = "snip";
    textarea.value = fullTex;
    form.appendChild(textarea);

    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopyStatus('copied');
    setTimeout(() => setCopyStatus('idle'), 2000);
  };

  const handleSaveSettings = () => {
    const trimmedApiKey = geminiApiKey.trim();
    if (!trimmedApiKey) {
      setErrorMessage("Vui lòng nhập Gemini API Key cá nhân.");
      return;
    }
    localStorage.setItem("gemini_api_key", trimmedApiKey);
    setGeminiApiKey(trimmedApiKey);
    setErrorMessage(null);
    setShowSettingsModal(false);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans transition-colors">
      
      {/* Header Bar */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm">
              <BarChart3 className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display font-bold text-xl tracking-tight text-slate-900">Vẽ hình Tikz AI</h1>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Tác giả: Thầy Vương Quốc Chiến
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Help Button */}
            <button
              onClick={() => setShowHelpModal(true)}
              className="w-9 h-9 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
              title="Hướng dẫn sử dụng"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            {/* Connection Status Badge */}
            <div className="px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-2 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              Gemini Connected
            </div>

            {/* Settings Button */}
            <button
              onClick={() => setShowSettingsModal(true)}
              className="w-9 h-9 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
              title="Cài đặt hệ thống"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Layout (3:7 ratio on desktop) */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 items-start">
          
          {/* LEFT PANEL: Input Options (3 cols) */}
          <section className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
            
            {/* Panel Header */}
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/50 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold text-slate-800">Upload Biểu Đồ</span>
            </div>

            {/* Panel Body */}
            <div className="p-4 space-y-4">
              {/* Upload Box */}
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all min-h-[190px] relative ${
                  dragActive
                    ? "border-blue-600 bg-blue-50/50"
                    : image
                      ? "border-slate-300 bg-slate-50/50 hover:border-blue-500"
                      : "border-slate-300/80 bg-slate-50/30 hover:border-blue-500 hover:bg-slate-50"
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => e.target.files?.[0] && handleUploadedFile(e.target.files[0])}
                  accept="image/*,application/pdf"
                  className="hidden"
                />

                {image ? (
                  <div className="w-full flex flex-col items-center">
                    {pdfFileName ? (
                      <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs text-center w-full max-w-xs">
                        <FileText className="w-10 h-10 text-rose-500 mx-auto mb-1" />
                        <span className="text-xs font-semibold text-slate-800 truncate block">{pdfFileName}</span>
                        <span className="text-[10px] text-slate-400">Trang đầu tệp PDF</span>
                      </div>
                    ) : (
                      <img
                        src={image}
                        alt="Preview uploaded"
                        className="max-h-32 rounded border border-slate-200 object-contain shadow-2xs bg-white p-1"
                      />
                    )}
                    <div className="mt-2.5 flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClear();
                        }}
                        className="text-xs text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Xóa ảnh
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center mb-2.5">
                      <Upload className="w-5 h-5 stroke-[1.8]" />
                    </div>
                    <p className="text-xs font-semibold text-slate-800">Kéo thả ảnh đề bài vào đây</p>
                    <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 font-medium">
                      hoặc <kbd className="px-1 py-0.5 text-[9px] font-mono bg-white border border-slate-300 rounded shadow-2xs text-slate-600">Ctrl</kbd> + <kbd className="px-1 py-0.5 text-[9px] font-mono bg-white border border-slate-300 rounded shadow-2xs text-slate-600">V</kbd> để dán ảnh
                    </p>
                    <p className="text-[10px] text-slate-400 mt-2 font-medium">Hỗ trợ JPEG, PNG, WEBP</p>
                  </>
                )}
              </div>

              {/* Prompt Box in Upload Tab */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                    Yêu cầu bổ sung cho AI (tùy chọn):
                  </label>
                  {userPrompt && (
                    <button
                      onClick={() => setUserPrompt("")}
                      className="text-[11px] text-slate-500 hover:text-rose-600 font-medium flex items-center gap-1 transition-colors"
                      title="Xóa prompt"
                    >
                      <Trash2 className="w-3 h-3" /> Xóa prompt
                    </button>
                  )}
                </div>
                <textarea
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleConvert();
                    }
                  }}
                  placeholder="Ví dụ: Tô màu đỏ đường parabol, thêm điểm O là giao điểm..."
                  rows={2}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 bg-slate-50/50 resize-none"
                />
              </div>

              {/* Convert Button */}
              <button
                onClick={() => handleConvert()}
                disabled={isConverting}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-sm active:translate-y-[1px]"
              >
                {isConverting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Đang chuyển sang code Latex...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Chuyển sang code Latex
                  </>
                )}
              </button>

              {/* Gemini API Key Notice Box */}
              {!geminiApiKey.trim() && (
              <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>Chưa có Gemini API Key!</span>
                </div>
                <p className="text-amber-700 leading-relaxed text-[11px]">
                  Vào <button onClick={() => setShowSettingsModal(true)} className="underline font-bold text-amber-800 hover:text-amber-950">Cài đặt</button> để nhập key. Lấy API key miễn phí tại{" "}
                  <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="underline font-bold text-amber-800 hover:text-amber-950 inline-flex items-center gap-0.5">
                    aistudio.google.com/apikey <ExternalLink className="w-3 h-3" />
                  </a>
                </p>
              </div>
              )}

              {/* Detailed TikZ Error Diagnostics Card */}
              {(errorMessage || tikzErrorDetails) && (
                <div className="p-4 rounded-xl bg-rose-50/90 border border-rose-200/90 text-xs text-rose-900 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between border-b border-rose-200/80 pb-2">
                    <div className="flex items-center gap-2 font-bold text-rose-800">
                      <Bug className="w-4 h-4 text-rose-600 flex-shrink-0" />
                      <span>{tikzErrorDetails?.errorType || "LỖI BIÊN DỊCH TIKZ"}</span>
                    </div>
                    {tikzErrorDetails?.errorLine && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-mono text-[10px] font-bold border border-rose-300">
                        Dòng {tikzErrorDetails.errorLine}
                      </span>
                    )}
                  </div>

                  {/* Offending Character if Unicode error */}
                  {tikzErrorDetails?.offendingChar && (
                    <div className="p-2 bg-rose-100/90 rounded-lg border border-rose-300 font-mono text-xs text-rose-900 font-bold flex items-center gap-2">
                      <span>Ký tự gây lỗi:</span>
                      <span className="px-2 py-0.5 bg-rose-200 text-rose-950 rounded font-black text-sm">{tikzErrorDetails.offendingChar}</span>
                    </div>
                  )}

                  {/* Suggestion */}
                  {tikzErrorDetails?.suggestion && (
                    <div className="p-2.5 bg-white/90 rounded-lg border border-rose-200 text-rose-800 font-medium leading-relaxed">
                      <strong>💡 Gợi ý hệ thống:</strong> {tikzErrorDetails.suggestion}
                    </div>
                  )}

                  {/* Suspected Command */}
                  {tikzErrorDetails?.suspectedCommand && (
                    <div className="space-y-1">
                      <span className="text-[11px] font-bold text-rose-800">Lệnh TikZ bị nghi ngờ:</span>
                      <pre className="p-2 bg-slate-900 text-amber-300 rounded-lg font-mono text-[11px] overflow-x-auto whitespace-pre-wrap border border-slate-800">
                        {tikzErrorDetails.suspectedCommand}
                      </pre>
                    </div>
                  )}

                  {/* Code Context around error line */}
                  {tikzErrorDetails?.lineContent && (
                    <div className="space-y-1">
                      <span className="text-[11px] font-bold text-rose-800">Mã nguồn xung quanh dòng lỗi:</span>
                      <div className="p-2 bg-slate-900 text-slate-300 rounded-lg font-mono text-[11px] overflow-x-auto space-y-0.5 border border-slate-800">
                        {tikzErrorDetails.contextBefore.map((line, idx) => (
                          <div key={`before-${idx}`} className="text-slate-400">
                            <span className="inline-block w-8 text-slate-500 select-none text-[10px]">
                              {(tikzErrorDetails.errorLine || 0) - tikzErrorDetails.contextBefore.length + idx}
                            </span>
                            {line}
                          </div>
                        ))}
                        <div className="bg-rose-950/80 text-rose-200 font-bold px-1 rounded">
                          <span className="inline-block w-8 text-rose-400 select-none text-[10px]">
                            {tikzErrorDetails.errorLine}
                          </span>
                          {tikzErrorDetails.lineContent}
                        </div>
                        {tikzErrorDetails.contextAfter.map((line, idx) => (
                          <div key={`after-${idx}`} className="text-slate-400">
                            <span className="inline-block w-8 text-slate-500 select-none text-[10px]">
                              {(tikzErrorDetails.errorLine || 0) + 1 + idx}
                            </span>
                            {line}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Raw Log if no line content */}
                  {!tikzErrorDetails?.lineContent && errorMessage && (
                    <p className="text-rose-700 font-mono text-[11px] leading-relaxed break-words">
                      {errorMessage}
                    </p>
                  )}

                  {/* Action Buttons for Error Resolution */}
                  <div className="pt-2 flex flex-wrap items-center gap-2">
                    {/* Button 1: AI Sửa mã TikZ */}
                    <button
                      onClick={handleAiFixTikz}
                      disabled={isAiFixing}
                      className="px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs active:translate-y-[1px]"
                    >
                      {isAiFixing ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          AI đang sửa mã...
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-3.5 h-3.5" />
                          AI sửa mã TikZ
                        </>
                      )}
                    </button>

                    {/* Button 2: Biên dịch lại */}
                    <button
                      onClick={() => handleRenderTikz(latexCode)}
                      disabled={isRenderingTikz}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs active:translate-y-[1px]"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRenderingTikz ? "animate-spin" : ""}`} />
                      Biên dịch lại
                    </button>

                    {/* Button 3: Sao chép mã */}
                    <button
                      onClick={() => copyText(latexCode)}
                      className="px-3 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs"
                    >
                      {copyStatus === 'copied' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {copyStatus === 'copied' ? "Đã sao chép" : "Sao chép mã"}
                    </button>

                    {/* Button 4: Tải mã TikZ */}
                    <button
                      onClick={handleExportTex}
                      className="px-3 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Tải mã TikZ
                    </button>

                    {/* Button 5: Mở trong Overleaf */}
                    <button
                      onClick={handleOpenInOverleaf}
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-all active:translate-y-[1px]"
                      title="Biên dịch chuẩn Overleaf với đầy đủ gói TeXLive"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Mở trong Overleaf
                    </button>

                    {/* Undo Button */}
                    {previousLatexCode && (
                      <button
                        onClick={handleUndoAiFix}
                        className="px-3 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs"
                        title="Khôi phục phiên bản trước khi AI sửa"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Hoàn tác
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* RIGHT PANEL: TikZ Image Render Preview & Code Window (7 cols) */}
          <section className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 flex flex-col space-y-4">
            
            {/* Top Bar inside Right Panel */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              {/* Left Tabs: Hình vẽ | Mã TikZ */}
              <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl">
                <button
                  onClick={() => setRightTab('render')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    rightTab === 'render'
                      ? 'bg-white text-slate-800 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                  Hình vẽ
                </button>
                <button
                  onClick={() => setRightTab('code')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    rightTab === 'code'
                      ? 'bg-white text-slate-800 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <TexStudioLogo className="w-4 h-4" />
                  Mã TikZ
                </button>
              </div>

              {/* Compile & Overleaf Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleRenderTikz(latexCode)}
                  disabled={isRenderingTikz}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shadow-2xs active:translate-y-[1px]"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRenderingTikz ? "animate-spin" : ""}`} />
                  Biên dịch
                </button>

                <button
                  onClick={handleOpenInOverleaf}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs active:translate-y-[1px]"
                  title="Mở ngay dự án trong Overleaf với đầy đủ TeXLive"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Mở trong Overleaf
                </button>
              </div>
            </div>

            {/* Output Container Box */}
            <div className="border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs bg-slate-50 flex flex-col min-h-[380px]">
              
              {/* Dark Header Banner */}
              <div className="bg-[#09101d] px-4 py-2.5 flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-[11px] font-bold tracking-wider uppercase text-slate-200 font-mono">
                    PREVIEW
                  </span>
                </div>
                {rightTab === 'code' && (
                  <button
                    onClick={() => copyText(latexCode)}
                    className="text-[11px] text-slate-300 hover:text-white flex items-center gap-1 font-mono"
                  >
                    {copyStatus === 'copied' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copyStatus === 'copied' ? "Đã sao chép" : "Sao chép"}
                  </button>
                )}
              </div>

              {/* Canvas Render Area */}
              <div className="flex-1 p-6 flex flex-col items-center justify-center relative bg-white/60 min-h-[320px]">
                {rightTab === 'render' ? (
                  isRenderingTikz ? (
                    <div className="flex flex-col items-center gap-3 text-sm text-slate-500 py-12">
                      <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
                      <p className="font-semibold text-slate-700">Đang biên dịch mã TikZ sang hình ảnh...</p>
                      <p className="text-xs text-slate-400">Đang kết nối dịch vụ biên dịch LaTeX Online</p>
                    </div>
                  ) : tikzImageUrl ? (
                    <div className="flex flex-col items-center justify-center w-full">
                      <img
                        src={tikzImageUrl}
                        alt="Compiled TikZ render"
                        className="max-h-[340px] object-contain rounded border border-slate-200/80 shadow-2xs bg-white p-4"
                      />
                    </div>
                  ) : (
                    /* Placeholder */
                    <div className="flex flex-col items-center justify-center text-center py-16 px-4">
                      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3 border border-slate-200/60">
                        <ImageIcon className="w-8 h-8 stroke-[1.5]" />
                      </div>
                      <h3 className="text-sm font-bold text-slate-700">Chưa có kết quả biên dịch</h3>
                      <p className="text-xs text-slate-400 mt-1">Nhấn Compile để xem hình</p>
                    </div>
                  )
                ) : (
                  /* TikZ Source Code Editor Tab */
                  <div className="w-full h-full flex flex-col">
                    <textarea
                      value={latexCode}
                      onChange={(e) => setLatexCode(e.target.value)}
                      className="w-full h-80 p-4 rounded-lg bg-slate-900 text-blue-200 font-mono text-xs leading-relaxed focus:outline-none resize-none border border-slate-800"
                      placeholder="% Mã TikZ sẽ xuất hiện ở đây..."
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div className="text-xs text-slate-500 flex items-center gap-1.5 font-medium">
                <HelpCircle className="w-4 h-4 text-blue-600" />
                <span>Mã nguồn TikZ được đồng bộ hóa tự động</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExportImage('png')}
                  disabled={!tikzImageUrl}
                  className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shadow-2xs ${
                    tikzImageUrl
                      ? 'bg-[#1e293b] hover:bg-[#0f172a] text-white'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Download className="w-4 h-4" />
                  Tải ảnh (PNG)
                </button>

                <button
                  onClick={handleExportTex}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 transition-all shadow-2xs"
                >
                  <FileCode className="w-4 h-4" />
                  LaTeX .TEX
                </button>

                <button
                  onClick={handleOpenInOverleaf}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 transition-all shadow-2xs"
                  title="Mở dự án trên Overleaf"
                >
                  <ExternalLink className="w-4 h-4" />
                  Mở trong Overleaf
                </button>
              </div>
            </div>

          </section>

        </div>
      </main>

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4 relative">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-display font-bold text-lg text-slate-900 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-blue-600" />
                Hướng dẫn sử dụng Vẽ hình TikZ AI
              </h2>
              <button onClick={() => setShowHelpModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <p><strong>1. Upload Ảnh / Tệp PDF đề bài:</strong> Chọn tệp hoặc kéo thả trực tiếp hình vẽ đề bài (Toán SGK, Đồ thị, Tam giác...) vào khu vực Upload hoặc nhấn <kbd className="px-1 py-0.5 bg-slate-100 border rounded font-mono">Ctrl + V</kbd> để dán ảnh trực tiếp từ clipboard.</p>
              <p><strong>2. Trích xuất AI:</strong> Hệ thống tự động nhận diện nét vẽ và sinh ra đoạn mã nguồn TikZ vector chuẩn SGK.</p>
              <p><strong>3. Biên dịch (Compile):</strong> Nhấn nút <strong>Compile</strong> góc phải để hiển thị trực tiếp đồ thị ảnh vector độ phân giải cao.</p>
              <p><strong>4. Tải Xuất File:</strong> Tải ảnh PNG sắc nét hoặc xuất mã nguồn <strong>.TEX</strong> dùng cho tài liệu LaTeX/Overleaf.</p>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4 relative">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-display font-bold text-lg text-slate-900 flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-600" />
                Cài đặt hệ thống
              </h2>
              <button onClick={() => setShowSettingsModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs text-slate-600">
              <label className="block font-semibold text-slate-700">
                Gemini API Key cá nhân (bắt buộc):
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  placeholder="Nhập Gemini API Key của anh..."
                  className="w-full p-2.5 pl-8 rounded-xl border border-slate-200 font-mono text-xs focus:outline-none focus:border-blue-600"
                />
                <Key className="w-4 h-4 text-slate-400 absolute left-2.5 top-3" />
              </div>
              <p className="text-[11px] text-slate-400">
                Key được lưu trong trình duyệt này và gửi qua kết nối HTTPS chỉ khi gọi Gemini. Vercel không cần cấu hình key dùng chung.
              </p>
            </div>
            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveSettings}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700"
              >
                Lưu cấu hình
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
