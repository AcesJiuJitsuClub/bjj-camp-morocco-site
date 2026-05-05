# BJJ Camp Morocco — Homepage Export

Static, semantic homepage built with **Tailwind CDN** + vanilla JS. Drops into any host (S3, Vercel, Netlify, Cloudflare Pages, traditional hosting) with zero build step.

## Files

| File | Purpose |
|---|---|
| `index.html` | The full homepage — every section semantic, accessible, and class-styled |
| `script.js` | Sticky-nav tracking, FAQ accordion, application form (5-step validation + submit), choice-card picker |
| `assets/` | Images, video posters, logo. **Replace placeholders before launch.** |
| `README.md` | This file |

## Quick start

Open `index.html` directly in a browser, or serve with any static server:

```bash
npx serve .
# or
python3 -m http.server 4321
```

## What's in the page (top → bottom)

1. **Sticky nav** — Experience / Schedule / Testimonials / FAQ + gold "Request Invitation" CTA. Auto-active on scroll.
2. **Hero** — Full-bleed video (`assets/hero-reel.mp4`) with poster fallback, headline, dual CTA.
3. **Flagship · The High Atlas Experience** — 7+5 split, 4 metric tiles, dual CTA, scarcity chip.
4. **Testimonials** — Featured video card + 3 supporting quote cards.
5. **Cinematic film band** — 21:9 recap reel.
6. **Future Expeditions** — 5 edition cards (1 active + 4 waitlist).
7. **"This is for you if…"** — 4-row typographic filter on bone.
8. **Founder · Mikal** — portrait + bio + 4 stat tiles.
9. **FAQ** — 7 questions, single-open accordion.
10. **Application** — Sticky-rail intro + 5-step form (name, email, belt pills, path cards, intent cards) + thank-you state.
11. **Footer · Inner Circle** — Lead capture (name + email + belt) → emotional pause → 5-column dark sitemap with social row.

## Production checklist

### 1. Replace placeholder assets

The `/assets/` folder ships with labelled placeholder images. Replace each with the real production asset (same filename, same aspect):

- `logo.png` — wordmark, transparent PNG
- `hero-reel.mp4` + `hero-poster.jpg` — hero video and fallback still
- `recap.mp4` + `reel-still.jpg` — recap reel and fallback still
- `flagship.jpg` — Atlas rooftop mat, golden hour (4:3 or 16:9)
- `testimonial-1.jpg` — featured testimonial portrait (16:10)
- `testimonial-2.jpg` … `testimonial-4.jpg` — 44px avatar circles
- `edition-01-atlas.jpg` … `edition-05-tangier.jpg` — 4:5 expedition tiles
- `founder.jpg` — Mikal portrait, 4:5

Source-code `<!-- comments -->` mark every asset reference for production handoff.

### 2. Wire the application form

`script.js` line 215 — replace the `TODO` with your endpoint:

```js
fetch("/api/applications", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(formData),
});
```

The footer Inner Circle form is wired the same way — pass it to your ESP (Klaviyo, Beehiiv, etc.).

### 3. Replace Tailwind CDN with a build (optional, for production)

For best performance, swap the `<script src="https://cdn.tailwindcss.com">` for a built CSS file:

```bash
npx tailwindcss -i ./input.css -o ./tailwind.css --minify
```

Bring your tokens across by copying the `tailwind.config = { ... }` block from the `<script>` tag in `index.html` into a `tailwind.config.js` file.

### 4. SEO

- `<title>` and `<meta name="description">` are in place
- Add Open Graph tags + favicon
- Submit `sitemap.xml` to Google Search Console

## Design tokens (from the design system)

```
--ink:      #0E0C0A   /* primary text */
--charcoal: #1A1612   /* dark surfaces */
--bone:     #F2EBDC   /* warm light */
--cream:    #FAF8F4   /* primary light surface */
--sand:     #F1E9D8   /* application surface */
--gold:     #C9A96E   /* primary accent / CTA hover */
--red:      #A52432   /* secondary accent / labels */
--mute:     #7A6F5E   /* secondary text */
```

Fonts: Cormorant Garamond (display serif), Inter Tight (sans), JetBrains Mono (mono labels). Loaded via Google Fonts in `<head>`.

## Browser support

Modern evergreen browsers (Chrome / Safari / Firefox / Edge, last 2 versions). Uses Tailwind v3 via CDN, native CSS Grid, `IntersectionObserver`, modern form validation. No IE11.

— BJJ Camp Morocco · Edition 01 · Marrakech, Oct 8–12, 2026
