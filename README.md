# Convert.

A private, browser-based universal file converter. The interface is built entirely from [shadcn/ui](https://ui.shadcn.com) components with [Lucide](https://lucide.dev) icons.

**Live app:** https://tezzaaaaaa.github.io/ultimate-file-converter/

Convert batches of media, images, documents, spreadsheets and presentations directly in the browser. Files are processed locally by the app; no conversion backend or account is required.

## Features

- Batch file selection and drag-and-drop
- Per-file output format selection
- Audio conversion: MP3, M4A, AAC, WAV, FLAC, OGG and OPUS
- Video conversion: MP4, MOV, WEBM, MKV, AVI and GIF
- Image conversion: JPG, PNG, WEBP, BMP and TIFF
- Image-to-PDF conversion
- Video frame extraction to a ZIP of JPG images
- Text-based document conversion for TXT, Markdown, HTML, DOCX, ODT, RTF and PDF
- Spreadsheet conversion for XLSX, XLS, CSV and ODS, including basic text-based PDF export
- Basic presentation text extraction/rebuilding for PPTX and ODP inputs
- ZIP packaging, progress reporting, and individual or batch downloads
- Responsive light and dark interface with reduced-motion support

## Design system

- **Components:** shadcn/ui (new-york style) — `button`, `card`, `badge`, `select`, `progress`, `separator`, `input`, `label`, `alert`, `tooltip`, `dropdown-menu`, `scroll-area`
- **Icons:** Lucide only (`lucide-react`), no custom icon fonts or emoji glyphs
- **Styling:** Tailwind CSS v4 with shadcn CSS variables; Geist as the default typeface
- **Theme:** dark by default, with light/system options persisted to `localStorage`

The primitives live in `src/components/ui` and can be regenerated or extended with the shadcn CLI (`components.json` is configured for this project).

## Important format limitations

This is a browser-based converter, not a full-fidelity Office rendering suite.

- Scanned/image-only PDFs are not OCR-processed.
- Document conversion focuses on text. Original page design, styles, tracked changes, images, tables and embedded objects may not be preserved.
- Spreadsheet-to-PDF output is a readable text export, not a reproduction of the original spreadsheet layout.
- Presentation-to-PDF output is a basic text export. Rebuilt PPTX files do not retain the original themes, layouts, animations, media or transitions.
- CSV can represent only one sheet; exporting a multi-sheet workbook to CSV may omit other sheets.
- Legacy binary DOC/PPT conversion, multi-page PDF-to-image export and high-fidelity Office-to-PDF rendering are not implemented.
- ZIP packages files; it does not convert their internal formats.

## Privacy and processing

Files are selected and processed in the browser. The app does not implement a file-upload API or require an account. Conversion libraries and the FFmpeg WebAssembly runtime are loaded from public CDNs, so an internet connection is required for those dependencies. The app does not send the selected media files to a conversion server.

## Run locally

```bash
npm install
npm run dev      # local dev server
npm run build    # typecheck + production build into dist/
npm run preview  # serve the production build
```

The project builds to a static `dist/` folder suitable for GitHub Pages or another static host. Serve the build through a web server rather than opening the file directly, because browser module and WebAssembly security rules can block `file://` execution.

## Technology

- [React](https://react.dev) + [TypeScript](https://www.typescriptlang.org)
- [Vite](https://vite.dev)
- [Tailwind CSS v4](https://tailwindcss.com) with [shadcn/ui](https://ui.shadcn.com)
- [Lucide](https://lucide.dev) icons
- [FFmpeg WebAssembly](https://github.com/ffmpegwasm/ffmpeg.wasm) for media conversion
- [SheetJS](https://sheetjs.com/) for spreadsheet processing
- [JSZip](https://stuk.github.io/jszip/) for Office-file reading and ZIP creation
- [pdf-lib](https://pdf-lib.js.org/) for PDF creation
- [PDF.js](https://mozilla.github.io/pdf.js/) for text-based PDF extraction

## Project structure

```
index.html               App shell (theme bootstrap, root element)
src/main.tsx             React entry point
src/App.tsx              Header, hero, steps, converter section, footer
src/components/converter.tsx   Queue, progress and downloads UI
src/components/format-guide.tsx Supported formats and privacy cards
src/components/ui/       shadcn/ui primitives
src/lib/formats.ts       Format metadata and capability rules
src/lib/converter.ts     FFmpeg / document conversion engine
```

## Branding

The `favicon.svg` file is used for the browser-tab icon.

## Credits and licensing

This project uses third-party open-source libraries. Their respective licenses apply. FFmpeg and its codecs may also have separate licensing considerations; review the applicable licenses for your use case.

## Status

Convert is a static, browser-based converter. Conversion support and output fidelity depend on the source format, target format, browser and included libraries.
