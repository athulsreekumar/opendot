# Brief for section builders

You are building one or two sections of the OpenDot website — an Apple-product-page-quality landing page for a Mac
app that gives you a team of AI assistants ("Dots"). The bar is *Apple.com product page*: huge confident type,
generous whitespace, real product imagery, motion that explains. If it looks like a generic SaaS template, it is not
done.

## Setup
- Work only in your git worktree (given in your task). Run `npm ci` first.
- Read `PLAN.md` §1 (rules), §4 (design system), §5 (copy), §6 (choreography for your section + §6.3/§6.4), and
  `lib/copy.ts` (all text comes from here — do not hard-code copy; if you need a new string, add it to your report and
  use a local constant marked `// TODO(copy)`).
- Orchestrator-owned files you must NOT edit: `styles/*`, `lib/copy.ts`, `app/layout.tsx`, `app/page.tsx`,
  `components/motion/*`, `components/ui/*` (except the files your task explicitly owns).

## Building blocks already on main
- Type & layout utilities (globals.css): `t-display-xl`, `t-display-l`, `t-display-m`, `t-title`, `t-lead`, `t-body`,
  `t-caption`, `text-gradient`, `container-site`, `container-text`, `section-pad`. Colour utilities: `bg-bg`,
  `bg-bg-alt`, `text-fg`, `text-fg-2`, `text-fg-3`, `border-line`, `bg-card`, `bg-accent`, `text-accent`,
  `text-brand-glow`, `shadow-window`, `shadow-card`, etc. Chapters: put `chapter-dark` or `chapter-light` on your
  `<section>` (the stub already has the right one — keep the `id`).
- `components/ui/`: `Button` (variant primary|secondary|ghost, size md|lg, href → <a>), `MacOnlyPill` (detail?),
  `MacWindow` (aspect, radius, title?; forwards ref), `Screenshot` (name, alt, theme?: "light"|"dark", priority?,
  sizes?), `Icon` (+ lucide re-exports), `Mascot` (`<Mascot pose="hero|thinking|cheer|night|conductor|shield|envelope|peek" size={…} />`
  — currently a placeholder sphere; the real 3D Odi lands later with the same API).
- `components/motion/`: `gsap.ts` (import `gsap`, `ScrollTrigger`, `useGSAP`, `prefersReducedMotion` ONLY from here),
  `useReducedMotion()`, `Reveal` (as?, delay?, y?, stagger?), `ScrubText` (text, as?, trigger?, start?, end?).
  Read `app/dev-ui/PinnedDemo.tsx` for the correct pinned-scrub pattern (use `end: () => "+=" + innerHeight * N`).
- `lib/early-access-client.ts`: `openEarlyAccess(source)` opens the signup dialog.
- Screenshots: `public/shots/<name>-<light|dark>@2x.(avif|webp)` for the names in PLAN §7.1 are being captured
  right now and will be merged later — reference them by name through `<Screenshot>`; it handles missing files. In
  dark chapters pass `theme="dark"`, in light chapters `theme="light"`.

## Motion rules
- `"use client"` only on components that animate; keep text server-rendered where possible.
- GSAP inside `useGSAP(() => {...}, { scope: ref })` (auto cleanup). Animate only transform/opacity/clip-path
  (small blur OK). Pins: `anticipatePin: 1`, scrub 0.6–1.
- Desktop-only pins via `gsap.matchMedia()` with `(min-width: 900px) and (prefers-reduced-motion: no-preference)`;
  mobile and reduced motion get a stacked, unpinned layout with simple `Reveal`s and everything visible.
- No layout shift: reserve space for images/video/mascot.
- Never leave content invisible if JS fails (initial hidden states only via GSAP `from`/`set` inside effects, or the
  pattern in `components/motion/motion.css`).

## Verify before handing back
1. `npm run lint && npm run typecheck && npm test && npm run build` pass. (`next build` rewrites `tsconfig.json` —
   run `git checkout tsconfig.json` after building; never commit it.)
2. `npx next start -p <your port>` in the background; take Playwright screenshots (Chromium executable:
   `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`; never run `playwright install`) of your section(s) at
   1440×900 and 390×844, light and dark OS (`colorScheme`), at several scroll positions through each pin
   (use `page.mouse.wheel` / `window.scrollTo` + wait 600ms). Also one run with `reducedMotion: "reduce"`.
3. **Look at every screenshot yourself** (Read the PNG) and iterate until it looks excellent. Check: no horizontal
   overflow at 320px (`document.documentElement.scrollWidth <= innerWidth`), no console errors (missing /shots 404s
   are expected for now), text never overlaps, pins release cleanly into the next section.
4. Kill your server: `fuser -k <port>/tcp` (do not `pkill -f "next start"`).
5. Commit on your branch, only your files, message ending with exactly:

```
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TpKQHy2fhi2RbwcYRyZWSZ
```

Do not push. Report: files, how each choreography works, screenshot paths (save them under `/tmp/claude-0/review/<task>/`),
and anything you couldn't do or new copy you need.
