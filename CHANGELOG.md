# Changelog

All notable changes to this project are documented here.

## [2.0.0] — 2026-11-01

### Changed

- Rebuilt the entire interface with shadcn/ui components (`button`, `card`, `badge`, `select`, `progress`, `separator`, `input`, `label`, `alert`, `tooltip`, `dropdown-menu`, `scroll-area`).
- Replaced all bespoke iconography with [Lucide](https://lucide.dev) icons via `lucide-react`.
- Migrated the site to React 19 + TypeScript + Vite, with Tailwind CSS v4 and shadcn CSS-variable theming.
- New layout: sticky header with theme switcher, hero, how-it-works strip, converter/queue workspace with a formats and privacy sidebar, and a structured footer.
- Dark theme is now the default, with light and system modes persisted locally.
- Conversion engine moved into typed modules (`src/lib/formats.ts`, `src/lib/converter.ts`) and is now lazy-loaded on first conversion.
- GitHub Pages workflow now builds the Vite bundle and deploys `dist/`.

### Removed

- Hand-written `styles.css` design system and the vanilla `app.js` UI.
- The previous Apple-inspired neumorphic presentation.

## [1.0.0] — 2026-09-07

### Added

- Initial macOS audio conversion Shortcut project.
- Local FFmpeg-based processing.
- Documentation for installation, usage, privacy, compatibility, and troubleshooting.
