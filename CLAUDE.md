# noise guaranteed website

Static site for noise guaranteed, a Belfast collective building electronic tools for music making. Hosted on GitHub Pages from `main`: plain HTML, CSS and vanilla JS, no build step.

**Before any visual, layout, copy or graphics work, read [BRAND.md](BRAND.md).** It holds the colours, type, noise and effects usage, graphics style, layout patterns, accessibility requirements, and which pages are live and which are prototypes.

Key points:
- The font is Atkinson Hyperlegible Mono, self-hosted via `css/fonts.css`. No Google Fonts, CDNs or trackers.
- Pixel noise and effects come from `js/noise.js` and `css/noise-fx.css`; dithering from `js/dither.js`.
- Accessibility is a requirement: contrast, no flashing, `prefers-reduced-motion`, alt text, visible focus, nav visible at all widths, no text over noise.
- Preview locally with `python -m http.server 8765`. Dithering needs http, not `file://`.
