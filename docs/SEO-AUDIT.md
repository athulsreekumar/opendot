# SEO audit

Audited on 2026-10-05 against a local production build (`VERCEL_ENV=production SITE_URL=https://opendot.live`, `next start`). The live domain returned `403` from the audit sandbox (egress blocked), so no live checks were possible: headers, the www redirect, HTTPS and the deployed version still need to be checked once by hand (see the end of this file).

"Before" means the state of `main` at commit `9020a3b`. "Status" says what this branch did about it.

## Findings

| # | Severity | Area | Finding | Status |
|---|----------|------|---------|--------|
| 1 | Critical | Reach | Only two indexable URLs (`/` and a policy page). One landing page cannot rank for "local AI assistant Mac", "Ollama Mac app", "MCP client Mac", "AI email assistant Mac" and so on, and there was nothing to link to or earn links for. | Fixed: 5 feature pages, 3 guides, 2 hubs and `/download` |
| 2 | High | Titles | Home `<title>` was brand-only ("OpenDot: your AI team, living on your Mac"), no search keywords. | Fixed: "OpenDot: Private AI Assistants for Mac, Any Model" (49 chars) |
| 3 | High | Internal links | The home page had 7 links, none to an inner page; nav used in-page anchors (`#create`) that break on any other page; footer had 2 links. | Fixed: nav, footer columns, "Learn more" links from each home section, FinalCta link to `/download` |
| 4 | High | Canonicals | The root layout sets `canonical: "/"`. Any new page that forgets its own canonical would tell Google it duplicates the home page. | Fixed: `pageMetadata()` always sets a canonical; unit test checks every page |
| 5 | High | Redirects | No www to apex redirect in the app. | Fixed in `next.config.ts` (`has: host www.opendot.live`, permanent). Also set it in Vercel (Domains) |
| 6 | High | 404 | Default Next 404: unbranded, no links out, and the response carried two conflicting robots tags (`noindex` plus the layout's `index, follow`). Status code was correctly 404. | Fixed: `app/not-found.tsx`, branded, helpful links, `noindex, follow` |
| 7 | Medium | Sitemap | No image entries; no inner pages. Dates were fine (fixed `lastmod`). | Fixed: 13 URLs, 26 image entries |
| 8 | Medium | Structured data | Home graph was valid (Organization, WebSite, SoftwareApplication, WebPage, FAQPage; all 5 parse). Organization lacked `sameAs` (GitHub). Inner pages had none. | Fixed: `sameAs`, plus per-page WebPage, BreadcrumbList, FAQPage and Article (guides). No `aggregateRating` anywhere, on purpose |
| 9 | Medium | Core Web Vitals | Home LCP is the hero paragraph or hero screenshot. Both sit inside `.hero-in` (0.9 s fade with 60 to 540 ms delay), so the first paint of the largest element is pushed out. Local numbers below. Mobile TBT is high (1.1 to 1.6 s at 4x CPU) from hydrating GSAP, Lenis and the WebGL mascot chunk. | Not changed (animation code is out of scope). Recommendation: drop the opacity fade on `.hero-in` for the paragraph and window, keep the translate |
| 10 | Medium | Social | One shared OG and Twitter image (`/opengraph-image`) for every page. | Open. Per-page OG images would improve click-through from shares |
| 11 | Medium | Content | `/privacy` is thin (87-char description, 17-char title, ~260 words, no breadcrumbs). It is a policy page, so it is fine to stay thin, but it could carry a better title. | Open (Low impact) |
| 12 | Low | Headings | Home H1 ("Your AI team. Living on your Mac.") has no search words; they are carried by the title and lead. One H1 per page everywhere. The "Statement" section renders its H2 twice (scrub copy plus static copy). | Open; harmless |
| 13 | Low | Metadata | `keywords` meta is ignored by Google. `robots.txt` has a non-standard `Host:` line (Yandex only, ignored elsewhere). No `twitter:site`. | Left as is |
| 14 | Low | Console | No JS errors on the production build. Warnings only: `THREE.Clock` deprecation and a WebGL `ReadPixels` GPU-stall message (headless software GL). | Report only |
| 15 | Low | No-JS | With JavaScript disabled all headings, paragraphs, FAQ answers and links are present in the HTML and visible. Only the animated "Summarise my week" demo answer is hidden until JS runs; it is a demo. | OK |
| 16 | Info | Redirects | `/privacy/` gives `308` to `/privacy` (trailing slash removed), matching the canonical URLs. `/dev-ui` and `/dev-odi` return `404` in production and are disallowed in robots. Unknown paths under `/features` and `/guides` return a real `404`. | OK |
| 17 | Info | Images | All content images have alt text, `width`/`height`, `sizes`, AVIF plus WebP, lazy-loading except the hero (eager, high priority). Typical file ~100 to 150 KB. | OK |
| 18 | Info | Indexability | Production: `index, follow` with `max-image-preview:large`. Non-production deployments: `noindex` meta, `X-Robots-Tag` header and `Disallow: /`. Sitemap, robots, manifest, `llms.txt` and the IndexNow key file all return 200. | OK |

## Keyword coverage

| Query a searcher would type | Before | After |
|---|---|---|
| AI assistant for Mac / AI assistants for Mac | Home only | Home title, `/features`, `/features/superdot` |
| local AI assistant Mac | None | `/guides/local-ai-assistant-mac-ollama`, `/features/any-model` |
| private AI assistant | Home copy only | `/features/privacy` |
| Ollama Mac app | Home marquee only | `/features/any-model`, Ollama guide |
| AI agents for Mac | Meta keywords only | `/features/always-on`, `/features/superdot` |
| MCP client Mac | None | `/guides/mcp-servers-mac`, `/features/connections` |
| AI email assistant Mac / Gmail | None | `/guides/ai-email-assistant-gmail` |
| OpenDot download | None | `/download` |
| personal AI team | Home copy | Home, `/features` |

Remaining content gaps worth writing next (only once the features exist in the app): comparison pages ("OpenDot vs ..."), a calendar-assistant guide, a "what is an AI agent" explainer, and a changelog or release notes page once downloads open.

## Core Web Vitals (local, Chromium via CDP, `next start`)

Localhost has no network latency, so absolute numbers are optimistic. Compare relative to each other.

| Page | Viewport | LCP | CLS | TBT |
|---|---|---|---|---|
| Home, before | 390x844, 4x CPU | 496 ms (hero paragraph) | 0 | 1380 ms |
| Home, before | 1440x900 | 268 ms | 0.016 | 255 ms |
| Home, after (3 runs) | 390x844, 4x CPU | 1.0 to 2.6 s (screenshot or paragraph; run-to-run noise, no home code changed except links) | 0 | 1.1 to 1.7 s |
| Home, after (3 runs) | 1440x900 | 0.73 to 0.92 s | 0.016 | 280 to 440 ms |
| `/features/superdot` | 390x844, 4x CPU | 408 ms (screenshot) | 0 | 400 ms |
| `/features/superdot` | 1440x900 | 136 ms | 0.025 | 23 ms |

INP proxy: single click and key interactions measured under 120 ms on the home page. The new pages are static server-rendered HTML with one tiny client button, so they are much lighter than the home page (no GSAP, no WebGL).

## GSAP scroll animations (owner report: "page looks static")

They initialise correctly on the production build. Evidence from Playwright:

- Desktop 1440x900: 5 `.pin-spacer` elements present (pinned sections), Lenis active (`html.lenis lenis-smooth`), no console errors.
- Hero window scrubs from `matrix(0.86, 0, 0, 0.86, 0, 40)` at scroll 0, to `0.9065` at 300 px, to `1` by 900 px.
- The "Every Dot has a job..." statement scrubs word colour as scrolled (screenshot at 2500 px shows partly lit text).
- Mobile 390x844: no pins by design (pins are desktop only), Lenis active, no errors.
- Reduced motion: no pins, no Lenis, everything visible.

If it looks static on the owner's machine, likely causes: "Reduce motion" enabled in macOS Accessibility settings (this disables pins and Lenis on purpose), or viewing a viewport under 900 px wide.

## Still to verify once, on the live site

1. `curl -sI https://opendot.live` returns 200 and `content-type: text/html`, with no `x-robots-tag: noindex`.
2. `curl -sI https://www.opendot.live` returns a `308` to `https://opendot.live/` (this branch handles it in the app; Vercel's Domains setting can do it too).
3. `curl -sI http://opendot.live` redirects to HTTPS.
4. The deployed commit matches `main`.
5. `https://opendot.live/sitemap.xml` lists 13 URLs after this branch is merged.
