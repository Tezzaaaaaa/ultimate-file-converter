# Convert.

A private, browser-based universal file converter with a clean shadcn/ui-inspired interface and Lucide-style icons.

**Live app:** https://tezzaaaaaa.github.io/ultimate-file-converter/

Convert batches of media, images, documents, spreadsheets and presentations directly in the browser. Files are processed locally by the app; no conversion backend or account is required.

## Features

- Batch file selection and drag-and-drop
- Per-file output format selection
- Audio conversion: MP3, M4A, AAC, WAV, FLAC, OGG and OPUS
- Video conversion: MP4, MOV, WEBM, MKV, AVI and GIF
- Image conversion: JPG, PNG, WEBP, BMP and TIFF, plus rasterisation of SVG inputs
- Image-to-PDF conversion
- Video frame extraction to a ZIP of JPG images
- Text-based document conversion for TXT, Markdown, HTML, DOCX, ODT, RTF and PDF
- Spreadsheet conversion for XLSX, XLS, CSV and ODS, including basic text-based PDF export
- Basic presentation text extraction/rebuilding for PPTX and ODP inputs
- ZIP packaging, progress reporting, and individual or batch downloads
- Responsive shadcn/ui-inspired interface with Lucide-style icons and reduced-motion support

## Important format limitations

This is a browser-based converter, not a full-fidelity Office rendering suite.

- Scanned/image-only PDFs are not OCR-processed.
- Document conversion focuses on text. Original page design, styles, tracked changes, images, tables and embedded objects may not be preserved.
- Spreadsheet-to-PDF output is a readable text export, not a reproduction of the original spreadsheet layout.
- Presentation-to-PDF output is a basic text export. Rebuilt PPTX files do not retain the original themes, layouts, animations, media or transitions.
- CSV can represent only one sheet; exporting a multi-sheet workbook to CSV may omit other sheets.
- Legacy binary DOC/PPT conversion, multi-page PDF-to-image export and high-fidelity Office-to-PDF rendering are not implemented.
- SVG inputs are rasterised to PNG before conversion, so text and shapes are flattened.
- TIFF inputs cannot be decoded by every browser, so they are rasterised through the FFmpeg engine first.
- ZIP packages files; it does not convert their internal formats.

## Privacy and processing

Files are selected and processed in the browser. The app does not implement a file-upload API or require an account. The first visit requires an internet connection to load the app and install its offline cache, which also stores the self-hosted UI fonts (DM Sans and Manrope) so no request leaves the device afterwards. The service worker stores the application, FFmpeg WebAssembly engine and conversion libraries on this device. Once the offline cache has finished installing, the app can be reopened and used without an internet connection. Keep this site's stored data to retain offline support. Selected media files are never sent to a conversion server.

## Offline use

Open the site once while online and wait for the service worker to finish installing the offline cache. Subsequent visits and conversions can run without a network connection. The FFmpeg WebAssembly engine, its worker and the UI fonts are served locally; conversion does not call a CDN.

`npm run test:offline` builds the app and then converts a media file, an image, a document, a spreadsheet and an SVG with the network disabled, which guards against offline regressions. Run `npm run fixtures` first if the sample files are missing (it needs the FFmpeg CLI).

## Run locally

Serve the project through a local web server rather than opening `index.html` directly with `file://`, because browser module and WebAssembly security rules can block local-file execution.

The project is a static HTML, CSS and JavaScript app suitable for GitHub Pages or another static host.

## Technology

- HTML, CSS and JavaScript
- [FFmpeg WebAssembly](https://github.com/ffmpegwasm/ffmpeg.wasm) for media conversion
- [SheetJS](https://sheetjs.com/) for spreadsheet processing
- [JSZip](https://stuk.github.io/jszip/) for Office-file reading and ZIP creation
- [pdf-lib](https://pdf-lib.js.org/) for PDF creation
- [PDF.js](https://mozilla.github.io/pdf.js/) for text-based PDF extraction
- [Fontsource](https://fontsource.org/) for the self-hosted DM Sans and Manrope webfonts

## Branding

The `favicon.svg` file is used for the browser-tab icon and the header logo.

## Credits and licensing

This project uses third-party open-source libraries. Their respective licenses apply. FFmpeg and its codecs may also have separate licensing considerations; review the applicable licenses for your use case.

## Status

Convert is a static, browser-based converter. Conversion support and output fidelity depend on the source format, target format, browser and included libraries.
