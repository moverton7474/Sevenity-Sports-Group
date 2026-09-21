# Sevenity Sports Group

Marketing site for [Sevenity Sports Group](https://sevenitysportsgroup.com) — an
athlete development and advisory firm in Atlanta founded by Chase Clemmons.
Training, NIL strategy, transfer-portal consulting, content, and Brand
Intelligence.

## What's here

A single static page. No build step, no dependencies, no framework.

```
public/
  index.html    markup, styles and the Brand Intelligence Engine, all inline
  og.jpg        1200x630 social card
  img/          photography and marks lifted from the official deck
    mark.png          the Sevenity logo (line-art basketball with the 7)
    favicon-*.png     64 / 192 / 512 icons built from the mark
    chase-*.jpg       founder portrait and training shot
    athlete-*.jpg     Ben Tuck, Jahmar Maurice, Will Myles, Ramone Seals
    seals-*.jpg       transfer-portal entry and FIU commitment
    logo-*.png        brand partner marks (Clean Energy, Jersey Mike's)
    coaches-map.jpg, scouts.jpg, player-development.jpg,
    clean-energy-activation.jpg, will-myles-analytics.jpg
  favicon.svg   earlier hand-drawn mark, kept but no longer referenced
  robots.txt
vercel.json     static config: outputDirectory, clean URLs, security headers
```

## Brand Intelligence Engine

The differentiator, and the only interactive part of the page. A visitor enters
their audience metrics — followers, comments, sends, DM shares — and the engine
ranks sponsor categories by how that audience actually behaves rather than by
how large it is. Sends per comment is the signal that drives most of the
ranking. It runs entirely client-side; nothing is transmitted.

## Brand palette

Derived from the logo, not chosen. The Instagram story ring around the avatar
was deliberately excluded — that is platform chrome, not brand color.

| Token | Dark | Light |
|---|---|---|
| accent | `#6FAEF0` | `#14559E` |
| mark | `#6FAEF0` | `#2E7AD6` |
| quiet | `#12263F` | `#DCE9F9` |

Logo source colors: sky `#78B5E3`, mid `#6097E7`, deep `#5E94E7`, linework
`#43454B`. Status colors (amber `#F5A742`, rose `#F2706A`) are intentionally
separate from the accent.

## Local preview

```bash
python3 -m http.server 8000 --directory public
```

## Deploying

Vercel, from `main`. `public/` is the output directory; there is nothing to
build.

## Known gaps

- **Logo is a 498px raster**, extracted from the official deck PDF. Good for
  every size the site uses. A true vector from the original designer
  (Kristiana Flowers, via Canva) would still be better for print.
- **Third-party marks and athlete likenesses** — Clean Energy, Jersey Mike's,
  and photographs of four named athletes appear on a public commercial page.
  Written clearance is still outstanding.
- **The Will Myles analytics screenshot** shows his personal Instagram
  dashboard. It needs his explicit sign-off.
