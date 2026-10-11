# atelier

The online portfolio of an artist.

A static site: every page is pre-built into plain HTML at build time, so
visitors download files rather than waiting on a server to assemble a page.
Images carry explicit dimensions and no web fonts are loaded, which is what
keeps the layout from shifting around as the page loads.

## Stack

| Piece | What it does |
| --- | --- |
| [Astro](https://astro.build) | Turns content files into static HTML; optimizes images |
| [Decap CMS](https://decapcms.org) | Browser-based editor at `/admin` so artwork can be added without touching code |
| Cloudflare Workers | Hosts the site (configured in `wrangler.jsonc`), rebuilding and deploying on every push to `main`; also runs the small GitHub login step for the editor |
| GitHub Actions | Verifies the site builds and type-checks on every pull request |

## Running it locally

```bash
npm install       # once, after cloning
npm run dev       # http://localhost:4321
```

| Command | Action |
| --- | --- |
| `npm run dev` | Local dev server with live reload |
| `npm run check` | Type-check + validate content against the schema |
| `npm run build` | Build the production site into `dist/` |
| `npm run preview` | Serve the built site locally, to check it before deploying |
| `npm test` | Test the CMS login code in `worker/` |
| `npm run logs` | Stream live logs from the deployed Worker |

## Project layout

```text
src/
├── content/artwork/     one Markdown file per piece (the data)
├── assets/artwork/      the image files themselves
├── content.config.ts    the schema — what fields a piece must have
├── layouts/             shared page shell (<head> tags, nav, footer)
├── pages/               each file here becomes a URL
│   ├── index.astro          /            the gallery
│   ├── about.astro          /about
│   └── artwork/[slug].astro /artwork/…   one page per piece, generated
└── styles/global.css    colors, spacing, typography
public/
├── admin/               the Decap CMS editor (served as-is)
└── robots.txt
worker/                  the CMS login code — the only part that runs on a server
wrangler.jsonc           Cloudflare config: what to serve, which paths run worker/
```

## Adding a new piece

**Option A — through the editor (intended for the artist):** go to
`https://<site>/admin`, log in with GitHub, click *New Piece*, fill in the form,
publish. That commits a Markdown file plus the image to this repo, which
triggers a rebuild. The new page is live in a minute or two.

**Option B — by hand:** drop the image in `src/assets/artwork/`, add a Markdown
file in `src/content/artwork/`:

```markdown
---
title: 'Morning Field'
year: 2026
medium: 'Oil on canvas'
dimensions: '90 x 120 cm'
image: '../../assets/artwork/morning-field.jpg'
imageAlt: 'A wheat field under low grey cloud'
description: 'Optional longer text shown on the artwork page.'
featured: false
---
```

Both routes produce identical files. The schema in `src/content.config.ts` is
enforced at build time — a missing or misspelled field fails the build rather
than silently publishing a broken page.

---

## One-time setup

These steps need accounts and dashboards, so they have to be done by hand.

### 1. Deploy to Cloudflare Workers

Cloudflare dashboard → **Workers & Pages** → **Create** → **Import a
repository** → pick this repo, then set:

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Preview command | `npx wrangler preview` |
| Environment variable | `NODE_VERSION` = `22` |

Leave **Cloudflare Access** off (it would put a login in front of the public
site). Wrangler reads everything else — the Worker name and which folder to
serve — from `wrangler.jsonc`.

From then on, every push to `main` deploys automatically, and with preview
builds enabled every other branch gets its own preview URL.

### 2. Set the real domain

These files contain the placeholder `https://example.com` and must be updated
once a domain is chosen, or the sitemap and social preview links will point at
the wrong place:

- `astro.config.mjs` → `site`
- `public/robots.txt` → the `Sitemap:` line

Also update `base_url` in `public/admin/config.yml`, and add the new callback
URL to the GitHub App (see [`worker/README.md`](worker/README.md)), or the
editor login stops working.

Attach the domain in the Worker's **Settings** → **Domains & Routes**.

### 3. Enable the CMS login

See [`worker/README.md`](worker/README.md) — create a GitHub App installed on
this repo only, then give its credentials to the Worker.

### 4. Turn on monitoring

- **Traffic + Core Web Vitals:** Cloudflare dashboard → **Web Analytics** →
  enable for the site. Once the custom domain runs through Cloudflare this
  can be switched on without a code change. It reports Cumulative Layout
  Shift (CLS) — the metric for "did things move around while loading" — plus
  load times, per page.
- **Uptime:** add the domain to a free checker such as
  [UptimeRobot](https://uptimerobot.com) to get an email if the site goes down.
- **Build failures:** GitHub notifies you when a CI run or deploy fails.

### 5. Replace the placeholder content

The site ships with one placeholder piece and stub text so the gallery is
demonstrably working end to end. Replace:

- `src/content/artwork/placeholder-study.md` and its image
- "Artist Name" in `src/layouts/BaseLayout.astro` and the page titles
- the artist statement in `src/pages/index.astro` and bio in `src/pages/about.astro`
