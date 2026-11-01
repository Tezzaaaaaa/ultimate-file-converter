/// <reference types="vite/client" />

declare module 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/+esm' {
  export const FFmpeg: any;
}

declare module 'https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.2/+esm' {
  export const fetchFile: (input: File | Blob | string) => Promise<Uint8Array>;
  export const toBlobURL: (url: string, mimeType: string) => Promise<string>;
}

declare module 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm' {
  const JSZip: any;
  export default JSZip;
}

declare module 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm' {
  const XLSX: any;
  export default XLSX;
}

declare module 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs/+esm' {
  const pdfjs: any;
  export default pdfjs;
}

declare module 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/+esm' {
  const PptxGenJS: any;
  export default PptxGenJS;
}

declare module 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm' {
  export const PDFDocument: any;
  export const StandardFonts: any;
  export const rgb: any;
}
