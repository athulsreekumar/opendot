# OpenDot Marketing Website

The marketing site for **OpenDot**, the open-source Mac app that gives you a team of AI assistants ("Dots").

[Screenshot: hero section with animated Odi mascot, early-access form, and macOS window showing the app interface]

---

## Run locally

**Requirements**: Node.js 22.19 or later.

```bash
npm ci
cp .env.example .env.local
RESEND_MOCK=1 npm run dev
```

Then open [http://localhost:3000](http://localhost:3000). The form won't send emails (mocked); to test with real Resend, add your API key to `.env.local`.

**Scripts**:

- `npm run dev` — Start the dev server
- `npm run build` — Build for production
- `npm run start` — Start the production server (requires `build` first)
- `npm run lint` — Lint with Biome
- `npm run typecheck` — Type-check with TypeScript
- `npm run test` — Run unit tests (Vitest)
- `npm run e2e` — Run e2e tests (Playwright)

---

## Deploy on Vercel

### 1. Connect the repo

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **Add New Project**
3. Select **Import Git Repository** and paste `https://github.com/athulsreekumar/opendot`
4. Choose **Next.js** as the framework (auto-detected)
5. Click **Deploy**

### 2. Set environment variables

In **Vercel → Project Settings → Environment Variables**, add each variable from `.env.example`:

| Variable | Type | What it does |
|---|---|---|
| `SITE_URL` | Optional | The deployed site URL (default: `https://opendot.live`). Used for canonical links and metadata. |
| `RESEND_API_KEY` | Required* | Resend API key with Sending and Contacts full access. |
| `RESEND_AUDIENCE_ID` | Optional | ID of the Resend Audience (segment) that stores signups. If empty, signups are only emailed to you. |
| `EARLY_ACCESS_NOTIFY_TO` | Required* | Your email address where signup notifications land. |
| `EARLY_ACCESS_FROM` | Optional | Sender address. Until `opendot.live` is verified in Resend: keep `OpenDot <onboarding@resend.dev>` (only that sender can email the account owner). After domain verification, set to `OpenDot <hello@opendot.live>`. |
| `EARLY_ACCESS_CONFIRM_FROM` | Optional | Once the domain is verified in Resend, set this to send signups a confirmation email (e.g., `hello@opendot.live`). |
| `UPSTASH_REDIS_REST_URL` | Optional | Upstash Redis REST endpoint. If omitted, rate limiting uses in-memory best effort. |
| `UPSTASH_REDIS_REST_TOKEN` | Optional | Upstash Redis REST token. |

*Required only if you want the form to send emails. For testing, set `RESEND_MOCK=1` locally instead.

After adding variables, **Vercel will auto-deploy** your project. Visit your preview URL.

### 3. Connect the domain (optional)

1. Go to **Vercel → Domains**
2. Click **Add Domain** and enter `opendot.live`
3. Follow the DNS setup shown in Vercel (add the CNAME or A records to your DNS provider)
4. Once verified, add the same domain to Resend for email sending (see below)

---

## Early-access emails with Resend

### Create a Resend account

1. Sign up at [resend.com](https://resend.com)
2. Verify your email address

### Get your API key

1. Go to **Settings → API Keys**
2. Create a new key with:
   - **Sending access**: enabled
   - **Contacts full access**: enabled
3. Copy the key to `EARLY_ACCESS_NOTIFY_TO` env var in Vercel

### Set up the Audience

1. Go to **Contacts → Audiences**
2. Click **Create Audience** and name it "OpenDot early access"
3. Copy its ID and paste it into `RESEND_AUDIENCE_ID` in Vercel
4. (Optional) If you leave `RESEND_AUDIENCE_ID` empty, signups still email you but won't be saved to a list

### Test after deploy

1. Visit your deployed site and submit a signup with `you+test@example.com` (change `you` to your email)
2. Check your inbox — you should get a notification email within seconds
3. In Resend → **Contacts**, find and delete the test contact

### Export the signup list

Anytime after people have signed up:

1. Go to **Resend → Contacts → Audiences**
2. Click your "OpenDot early access" audience
3. Click **Export** and download the CSV

### Verify the domain (optional, for nicer sender address)

By default, emails come from `OpenDot <onboarding@resend.dev>` (Resend's only-works-for-account-owner sender).  
To send from `hello@opendot.live`:

1. Go to **Settings → Domains** in Resend
2. Click **Add Domain** and enter your domain (e.g., `opendot.live`)
3. Add the DNS records shown (TXT, DKIM, DMARC)
4. Once verified, set in Vercel:
   - `EARLY_ACCESS_FROM=OpenDot <hello@opendot.live>`
   - (Optional) `EARLY_ACCESS_CONFIRM_FROM=hello@opendot.live` (signup confirmations)

### Security note

**Never commit API keys.** If a key is ever posted publicly, rotate it immediately in Resend → Settings → API Keys.

---

## Project structure

```
opendot/
├─ README.md                    this file
├─ PLAN.md                      build plan & detailed specs
├─ package.json  tsconfig.json  biome.json  next.config.ts
├─ .env.example                 every env var, no values
│
├─ app/
│  ├─ layout.tsx                fonts, metadata, <SmoothScroll>, theme
│  ├─ page.tsx                  the landing page
│  ├─ privacy/page.tsx          privacy notice
│  ├─ api/early-access/route.ts signup endpoint
│  └─ opengraph-image.png       OG image for sharing
│
├─ components/
│  ├─ site/                     Nav, Footer, EarlyAccessForm, etc.
│  ├─ sections/                 Hero, Statement, CreateDot, etc.
│  ├─ motion/                   SmoothScroll, Reveal, ScrubText, GSAP helpers
│  ├─ mascot/                   Odi (3D character, React Three Fiber)
│  └─ ui/                       Button, MacWindow, Screenshot, etc.
│
├─ lib/
│  ├─ copy.ts                   all text copy (headings, CTAs, etc.)
│  ├─ early-access.ts           signup logic (pure, unit-tested)
│  ├─ env.ts                    typed environment variable reader
│  ├─ rate-limit.ts             request rate limiter
│  └─ site.ts                   site metadata
│
├─ styles/
│  ├─ tokens.css                design tokens (colors, sizes, etc.)
│  └─ globals.css               base styles
│
├─ public/
│  ├─ film/                     hero loop & full film videos
│  └─ mascot/                   Odi fallback images (PNG/WebP)
│
├─ scripts/
│  └─ render-mascot.ts          render Odi's static images
│
├─ tests/
│  ├─ unit/                     API and utility unit tests (Vitest)
│  └─ e2e/                      site e2e tests (Playwright)
│
├─ .github/workflows/ci.yml     GitHub Actions CI (lint, build, test, e2e)
└─ (future: capture/            footage recording & screenshot tools)
   (future: film/               Remotion edit project)
```

---

## Updating assets

### Screenshots

Site screenshots (for sections like "Create a Dot", "Always on", etc.) are captured from the OpenDot app. When available:

1. See `capture/README.md` for the full capture pipeline
2. Run `capture/shots.ts` to generate all stills (light & dark, optimized to AVIF/WebP)
3. Output lands in `public/shots/`

(The capture tooling is not yet in this repo; see [PLAN.md §7.1](PLAN.md#71-screenshots-real-app-dummy-data) for details.)

### Mascot images (Odi)

Odi is a real-time 3D character rendered in the browser. To generate static fallback images:

```bash
npm run dev        # in one terminal (the /dev-odi route is dev-only)
```

In another terminal:

```bash
node --experimental-strip-types scripts/render-mascot.ts
```

This renders each of Odi's poses (`hero`, `thinking`, `cheer`, `night`, `conductor`, `shield`, `envelope`, `peek`) to `public/mascot/odi-<pose>.{png,webp}` at 2× DPR, optimized with sharp.

**Env vars** (optional):
- `BASE_URL` — dev server URL (default: `http://localhost:3000`)
- `PW_CHROMIUM` — explicit Chromium executable path (uses Playwright's by default)

### Film

(Coming soon: Remotion edit project in `film/` that produces the hero loop and full film video.)

---

## Design system

### Copy

All text copy (headlines, buttons, CTAs, form labels) lives in `lib/copy.ts`. Change wording there, and it updates everywhere.

GitHub link constant: `lib/copy.ts` exports `GITHUB_URL`.

### Tokens

Design tokens (colors, fonts, sizes) are in `styles/tokens.css`:

- **Colors**: `--bg`, `--bg-alt`, `--fg`, `--fg-2`, `--accent`, `--accent-grad`, `--line` (mirrored for light/dark)
- **Type scale**: `display-xl`, `display-l`, `display-m`, `title`, `lead`, `body`, `caption` (fluid sizes with Tailwind `clamp`)
- **Spacing, shadows, radii**: standard Tailwind + custom values

Dark mode is toggled via `prefers-color-scheme` (hero & nav only; chapter backgrounds are designed fixed).

### Fonts

- **Inter Variable** (self-hosted) — headlines and body text, with optical-size axis for crisp display type
- **JetBrains Mono** (self-hosted) — mono code examples and masked data demos

Loaded in `app/layout.tsx` via `@fontsource-variable`.

---

## Questions?

See [PLAN.md](PLAN.md) for:

- Detailed build plan & tech stack (§2)
- Copy deck & exact strings (§5)
- Scroll choreography & animations (§6)
- Assets pipeline (§7)
- Early-access backend logic (§8)
- Capture & film rendering (§9)
- Testing & QA approach (§10)

