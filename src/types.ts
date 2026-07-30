export interface SampleItem {
  id: string;
  name: string;
  description: string;
  latex: string;
  svgIcon: string; // inline SVG representation to avoid heavy base64 strings
}

export type PreviewTheme = 'white' | 'grid' | 'chalkboard' | 'slate';

export interface HistoryItem {
  id: string;
  timestamp: string;
  latex: string;
  mode: 'formula' | 'explain' | 'tikz';
  imageUrl?: string;
}
