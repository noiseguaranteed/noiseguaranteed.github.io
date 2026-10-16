# noise guaranteed: brand and style guidelines

How noise guaranteed looks, sounds and behaves online. Use this for any work on this site, and for printed or social graphics. The prototype pages listed under [Reference pages](#reference-pages) show everything here in action.

**The core idea: digital noise inside analogue noise.** In the logo and the *Noise Guaranteed combo 1* video, crisp pixel blocks sit inside a black ring that smears, tears and picks up colour. Clean pixels, rough edges.

---

## 1. Voice

- **Lowercase** for the name, headings and navigation: *noise guaranteed*, *workshops*, *book & build*. Ordinary sentences are capitalised normally, including a hero headline that is a full sentence.
- **Plain, direct and a bit playful.** "Make some noise. We'll bring the parts." Short sentences, everyday words.
- **We question technology from a position of naivety.** We're makers, not experts, and we're comfortable saying so.
- **Tagline:** *a noise-positive organisation*.
- **Use British English:** colour, organisation, programme.

## 2. Colour

### Core palette

| Role | Colour | Notes |
|---|---|---|
| Ink | `#000000` | All body text and lines. 17.8:1 on cream. |
| Paper | `#fdeac8` | Cream page and card background. |
| Panel | `#ffffff` | Cards, boxes and table backgrounds on cream. |
| Nav green | `#81ff73` | Header bar, highlights, date strips, button text on black. |
| Hover magenta | `#f273ff` | Hover state. The magenta in dithered photos. |

### Logo palette

Used for noise, pixel art and accents: `#00ff00` `#0000ff` `#00ffff` `#ff40ff` `#ffff00` `#ff0000`, plus black and white.

**Soft palette** (pastel noise): `#81ff73` `#f273ff` `#73f2ff` `#fff273` `#7381ff`

### Colour and text contrast

- **On cream or white, use only black text** (17.8:1). The logo blue `#0000ff` also passes (7.3:1) but use it sparingly. Every other brand colour fails as text on light backgrounds: green 1.2:1, yellow 1.1:1, magenta 2.4:1.
- **Bright colours as text only on black.** Green on black is 16.5:1, which is what the buttons use.
- **Black on a bright background is fine:** on nav green 16.5:1, on magenta 8.7:1.
- Never rely on colour alone to carry meaning; add text or a symbol, as the shop's stock labels do (● in stock, ◐ low, ○ coming soon).

### Washes

One tint per page, taken from the combo 1 video. Set it with `<html data-wash="teal">`; the colours are defined in [css/noise-fx.css](css/noise-fx.css). A wash recolours the nav, cards, footer, noise drawn with the `wash` palette, and colour fringes. Black text on every wash colour is at least 7:1 (WCAG AAA).

| Wash | Nav | Hover | Cards | Black-text contrast (nav) |
|---|---|---|---|---|
| green | `#4fd84a` | `#b4f5a8` | `#e6f6df` | 11.3:1 |
| teal | `#6cc2b1` | `#bfe6dd` | `#e2f2ee` | 10.0:1 |
| sage | `#a9cba2` | `#d6e8d0` | `#eef5eb` | 11.8:1 |
| ochre | `#d6a454` | `#eed3a3` | `#f7ead5` | 9.3:1 |
| rose | `#e58aa4` | `#f5c6d3` | `#fbe6ec` | 8.5:1 |
| grey | `#b4b0aa` | `#dcd9d4` | `#f1efec` | 9.7:1 |

No page has been given a wash yet (see [Open decisions](#open-decisions)).

## 3. Typography

**Atkinson Hyperlegible Mono, everywhere.** Made by the Braille Institute for low-vision readers. Letters that are easily confused (I l 1, O 0, rn m) are drawn to look clearly different, and it keeps the site's monospace, datasheet character.

```css
@import url('css/fonts.css'); /* or <link rel="stylesheet" href="css/fonts.css"> */
body { font-family: 'Atkinson Hyperlegible Mono', 'Courier New', monospace; }
```

- **Served from the site:** the font files are in [fonts/](fonts/) and declared in [css/fonts.css](css/fonts.css). **Never link to Google Fonts or any other font service:** it sends visitors' IP addresses to a third party.
- **Sizes:** body 16px (16–17px is fine), never smaller than 13px, even for labels. Line height 1.6. Paragraphs at most about 65 characters wide (`max-width: 65ch`).
- **Weight:** bold for headings, prices and buttons; regular for everything else. The font is variable, so weights 200–800 are available, but keep to regular and bold.
- **Headings:** lowercase, bold. Large page headings can use `clamp(34px, 6vw, 56px)`.
- **All caps** only for short labels: `STEP 1`, `SHOP · BELFAST`, `FREE`. Use real lowercase text with `text-transform: uppercase`, so screen readers don't spell it out letter by letter.
- **Also in [fonts/](fonts/), not used on the site:** Atkinson Hyperlegible Next (sans-serif) and Departure Mono (pixel font). Departure Mono could suit stickers or posters; it's sharpest at multiples of 11px (44, 55, 66px) and has no bold.
- All three fonts are under the SIL Open Font License; the licence files are in [fonts/](fonts/).

## 4. Logo

- File: [images/ng_logo_trans_bkg_sml.png](images/ng_logo_trans_bkg_sml.png), a pixel-noise tick inside a black ring on a transparent background.
- **In the header it links home.** If the link also contains the text "noise guaranteed", give the image `alt=""`; if the image is alone in the link, use `alt="noise guaranteed home"`.
- **Optional:** `data-tear="hover"` makes it tear like tape when hovered or focused (see [Analogue effects](#6-analogue-effects)).
- Don't recolour, stretch or redraw the logo. Leave white space around it.

## 5. Pixel noise: js/noise.js

Seeded pixel noise drawn into `<canvas>` elements. **The same seed always gives the same pattern.** A wider screen shows more of the same pattern, not a different one.

```html
<canvas class="noise" aria-hidden="true" data-seed="workshops" data-cell="5" data-density="0.6"></canvas>
<script src="js/noise.js"></script>
```

Give every noise canvas a height in CSS: `canvas.noise { display: block; width: 100%; height: 16px; }`.

| Attribute | Values | Default |
|---|---|---|
| `data-seed` | any word or number; `random` = new pattern each load | `noise` |
| `data-cell` | block size in CSS px | `6` |
| `data-density` | 0–1, share of blocks coloured | `0.5` |
| `data-palette` | `logo`, `soft`, `mono`, `wash`, or comma-separated colours | `logo` |
| `data-style` | `blocks`, or `stripes` (vertical tape stripes) | `blocks` |
| `data-fade` | `none`, `left`, `right`, `ends`, `edges` | `none` |
| `data-mask` | `circle` | none |
| `data-drift` | blocks changed per tick (twice a second); `0` = still | `0` |
| `data-bg` | background colour | transparent |

JavaScript API: `NoiseGuaranteed.render(canvas, opts)`, `.image(w, h, opts)` (an off-page canvas, e.g. for PNG export), `.favicon(opts)`, `.tear(source, canvas, opts)`, `.refresh()`.

**Seeds:** use the page or item name (`data-seed="shop"`, `data-seed="shoestring"`), so each page has its own fixed pattern. The header strip uses `"noise guaranteed"`.

**Where noise goes:**
- a strip under the header
- dividers, often with `data-fade="ends"`
- product and voucher artwork in place of missing photos
- the favicon

**Rules:**
- **Never put text on top of noise.** Text always sits on a solid colour.
- Noise is decorative: always `aria-hidden="true"`.
- Use `data-drift` sparingly. It changes at most twice a second and stops automatically under `prefers-reduced-motion`.

## 6. Analogue effects

Accents from the VHS video. Use them as moments, not everywhere.

- **Tape tear on images:** `<img data-tear="hover">` (or `"load"` for once on page load). The real `<img>` stays in the page, so its alt text is kept. Small images like the logo (under 341 × 256 / 4 px² in area, the WCAG 2.3.1 exemption) tear quickly; anything larger is limited to three frames a second. Nothing tears under reduced motion.
- **Colour fringe:** `class="fringe"` on **large headings only**. Red and cyan ghosts (or the wash's own pair) trail to the right, kept off the letters by a 1px outline in the background colour, so the letter edges stay sharp. The gap colour is `--fringe-gap`: cream by default, and the card colour automatically on washed pages. **On any other background, set it to match**, e.g. `style="--fringe-gap:#fff"` on a white panel, or `--fringe-gap: var(--nav)` on a green highlight. Otherwise a cream outline shows. It switches off under `prefers-contrast: more` and in Windows High Contrast.
- **Stripes:** `data-style="stripes"` on a noise canvas, for bands and dividers.
- **Don't:** run a VHS filter over the whole page, animate continuously, or put effects behind text.

## 7. Graphics

Same grammar as the logo: **a crisp black line, filled with noise.** See [graphics-style.html](graphics-style.html).

| Picture | Style | Tools |
|---|---|---|
| Photos | Dithered: black + magenta (`#000`, `#f273ff`, as in `hs_dithered.png`) or black + green | [tools/dither.html](tools/dither.html) |
| Synths, diagrams, components | Black line drawing, noise fill in one or two parts | Inkscape; trace KiCad / FreeCAD exports for accuracy |
| Icons, favicon, stickers | True pixel art, 16 × 16 or 32 × 32, logo palette | Pixelorama (free), Aseprite |
| Zines, handouts | Hand-drawn, scanned, then dithered | Pen and paper, then the dither tool |

**Line drawings:**
- **Lines:** all one weight (5px at full size), with round ends and joins.
- **Noise:** in one or two parts only, such as a speaker cone or a chip body. Use the `ngfill` SVG pattern from [graphics-style.html](graphics-style.html), with plain magenta as the fallback (`fill="url(#ngfill) #f273ff"`).
- **Labels:** real text in the brand font with thin (2px) leader lines. Never text drawn into the picture, and never a pixel font for labels.

**Dithering:** [js/dither.js](js/dither.js) offers Atkinson (the default: crisp and high contrast), Floyd-Steinberg (smoother) and Bayer (cross-hatched) dithering. Reading an image's pixels needs a same-origin image, so use GitHub Pages or `python -m http.server`, not `file://`.

**Alt text:** every image gets alt text that says what it shows. For diagrams, say which parts are labelled, not just "diagram". Inline SVGs get `role="img"` with a `<title>` and `<desc>`.

## 8. Layout

Based on [shop-v2.html](shop-v2.html):

- **One column, up to 900px wide.** Side padding 24px, or 16px under 480px wide.
- **Header:** a nav-green bar with a 2px black bottom border. The logo and name on the left link home; links on the right **wrap onto a new line on small screens and are never hidden**. Mark the current page with `aria-current="page"`. A noise strip goes directly below.
- **Hero:**
  - a short all-caps line above the headline (`SHOP · … · BELFAST`)
  - a large headline written as a sentence ("Make some noise. We'll bring the parts."), which can highlight a phrase with a nav-green background
  - a bordered noise band
  - an intro paragraph
- **Section headings** are numbered like a lab sheet: `01` followed by the heading and a dotted rule to the right.
- **Cards:** white, 2px solid black border, **square corners** (no rounded corners anywhere).
- **Buttons:** black background, nav-green bold text, magenta background with black text on hover, at least 44px tall, and a 3px black focus outline offset by 3px.
- **Dated cards** (workshops, markets) have a nav-green strip at the top with the date and place.
- **Process steps:** an `<ol>` across the page, stacking on phones.
- **Footer:** white, with a row of short facts and the name.

## 9. Accessibility checklist

These are requirements, not nice-to-haves:

- [ ] Text contrast at least 4.5:1, aiming for 7:1. Black on cream, white or any wash passes.
- [ ] Nothing flashes more than three times a second. Motion stops under `prefers-reduced-motion`. Anything that moves for more than 5 seconds can be paused.
- [ ] No text over noise, images or effects.
- [ ] Every meaningful image has alt text. Decorative noise and effect canvases are `aria-hidden="true"`.
- [ ] Navigation is visible and usable at every screen width. Every interactive element has a visible keyboard focus style.
- [ ] Buttons and links make sense out of context. Example: "buy the squeal & scrape kit · £20 (opens SumUp checkout)", using visually hidden text where needed.
- [ ] Real HTML structure: `<header>`, `<nav>`, `<main>`, `<footer>`, headings in order, lists for lists.
- [ ] Body text at least 16px, labels at least 13px.
- [ ] No third-party trackers, fonts or analytics.
- [ ] Workshop bookings ask about access needs.

## 10. Technical constraints

- **GitHub Pages:** static files, no build step, no server code. Checkout and booking go through hosted services (planned: SumUp for products, vouchers and market card payments; Tito or similar for workshop tickets).
- **No external CDNs.** Fonts and scripts are served from this repo.
- Plain HTML, CSS and vanilla JavaScript, in the same style as `js/noise.js`.
- **To preview locally:** `python -m http.server 8765`, then open `http://127.0.0.1:8765/`.

## Reference pages

| File | What it is | Status |
|---|---|---|
| [index.html](index.html), [workshops.html](workshops.html), [bookbuild.html](bookbuild.html), [people.html](people.html) | The live site | **Old style:** Courier New, `css/noise.css`, no brand updates yet |
| [noise-demo.html](noise-demo.html) | Noise lab: strips, washes, tears, fringe, stripes, playground | Prototype |
| [shop-v2.html](shop-v2.html) | Shop in the target layout | Prototype, placeholder products and links |
| [shop.html](shop.html) | First shop draft in the old layout | Superseded by v2 |
| [graphics-style.html](graphics-style.html) | Graphics styles side by side | Prototype |
| [type-specimen.html](type-specimen.html) | Type options A–D | Reference; option **B** chosen |
| [tools/dither.html](tools/dither.html) | Photo dither tool | Ready to use |
| [js/noise.js](js/noise.js), [js/dither.js](js/dither.js), [css/noise-fx.css](css/noise-fx.css), [css/fonts.css](css/fonts.css) | Shared code | Ready to use |

## Open decisions

- **Washes:** which wash, if any, each page uses.
- **Rollout:** apply the shop-v2 layout and Atkinson Hyperlegible Mono to the live pages.
- **Shop:** real products, prices, SumUp payment links, market dates and contact email. Confirm the refund policy.
- **Ticketing:** confirm the service for workshop tickets.
- **Tidy-up:** remove [shop.html](shop.html) once v2 is adopted.
