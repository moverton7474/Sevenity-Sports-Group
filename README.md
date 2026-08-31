# Sevenity Sports Group

Marketing site for [Sevenity Sports Group](https://sevenitysportsgroup.com) — an
athlete development and advisory firm in Atlanta founded by Chase Clemmons.
Training, NIL strategy, transfer-portal consulting, content, and Brand
Intelligence.

## What's here

A single static page. No build step, no dependencies, no framework.

```
public/
  index.html    the entire site — markup, styles, and the Brand Intelligence
                Engine, all inline so the page is self-contained
  favicon.svg   brand-blue mark
  logo.png      the Sevenity mark, 72x72 (also embedded in index.html as a
                data URI so the page never blocks on a second request)
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

- **`og.png` is not in the repo yet.** The Open Graph and Twitter `image` tags
  were removed rather than left pointing at a missing file. Add
  `public/og.png` (1200x630) and restore `og:image`, `og:image:width`,
  `og:image:height`, `og:image:alt` and `twitter:image` together.
- **Logo is a 72px raster.** Fine at its 26px display slot; get the original
  vector from Chase before using the mark anywhere large.
- **Portfolio names in the Track Record section** need written clearance for
  public commercial use.
