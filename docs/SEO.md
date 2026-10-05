# SEO: what to do after deploying

Everything technical is already in the code: metadata, canonical URLs, sitemap, robots, structured data (Organization, WebSite, SoftwareApplication, WebPage, FAQPage), social images, icons, manifest, `llms.txt` and IndexNow. The steps below need an account or a DNS record, so only you can do them.

## 1. Google Search Console

1. Go to https://search.google.com/search-console and choose **Add property**, then **Domain** and enter `opendot.live`.
2. Verify with a DNS TXT record at your registrar (copy the value Google shows). This also covers `www` and every subdomain.
   - Alternative: choose the **URL prefix** option, pick the HTML tag method, copy the `content` value and set it as `GOOGLE_SITE_VERIFICATION` in Vercel (Project, Settings, Environment Variables, Production). Redeploy, then click Verify.
3. Open **Sitemaps** and submit `https://opendot.live/sitemap.xml`.
4. Open **URL inspection**, paste `https://opendot.live/`, wait for the check, then click **Request indexing**.
5. Check back in a few days: **Pages** should show 2 indexed pages (`/` and `/privacy`).

## 2. Bing Webmaster Tools

1. Go to https://www.bing.com/webmasters and sign in.
2. Easiest: **Import from Google Search Console**. It copies the site and sitemap.
3. Or add `https://opendot.live` manually and verify with the meta tag: set `BING_SITE_VERIFICATION` in Vercel to the `msvalidate.01` content value, redeploy, then verify. Submit `https://opendot.live/sitemap.xml`.
4. Bing powers DuckDuckGo, Ecosia and many AI assistants, so this matters.

Yandex is optional: set `YANDEX_VERIFICATION` the same way.

## 3. IndexNow (automatic)

After every successful **Production** deployment, the GitHub Action `.github/workflows/indexnow.yml` submits all sitemap URLs to IndexNow (Bing, Yandex, Seznam, Naver). Nothing to configure. It needs Vercel's GitHub integration to be on (it is by default). To run it by hand, open the repo's Actions tab, choose **IndexNow**, then **Run workflow**. The key file lives at `public/<key>.txt` and the key is `INDEXNOW_KEY` in `lib/site.ts`. Keep them identical.

## 4. Check the structured data

- Rich Results Test: https://search.google.com/test/rich-results , enter `https://opendot.live/`. Expect valid FAQ and Software app items.
- Schema validator: https://validator.schema.org/ for the full graph.
- Social previews: paste the URL into https://www.opengraph.xyz/ or the LinkedIn Post Inspector. The share image is generated at `/opengraph-image`.

Google no longer shows FAQ rich results for most sites, but the FAQ still helps ranking for long questions and gets quoted by AI answers.

## 5. Optional: measure speed and traffic

In Vercel, open the project, then **Analytics** and **Speed Insights**, and enable both. Add `@vercel/analytics` and `@vercel/speed-insights` to the app when you want them (the privacy page currently says there are no trackers, so update it if you add analytics).

## 6. Previews are hidden on purpose

Any deployment where `VERCEL_ENV` is not `production` is served with `noindex` (meta tag and `X-Robots-Tag` header) and a `Disallow: /` robots file. If you ever see a `*.vercel.app` URL in Google, check that the production domain is set as the primary domain in Vercel.

## 7. Off-page checklist (what actually moves rankings)

- [ ] Link to https://opendot.live from the GitHub README, repo "Website" field and the GitHub org profile.
- [ ] Product Hunt launch (when downloads open). Prepare the tagline, gallery and a maker comment.
- [ ] Hacker News "Show HN" post once there is something to try.
- [ ] Post in relevant communities: r/macapps, r/LocalLLaMA, r/ollama, r/selfhosted, MCP community lists.
- [ ] Submit to directories: AlternativeTo, Futurepedia, There's An AI For That, awesome-mcp lists, awesome-macOS lists, Mac app roundups.
- [ ] Get listed in the MCP clients lists and the Ollama community integrations page.
- [ ] Write one or two launch posts (for example "Why Dots, not one big chatbot") and link them to the site.
- [ ] Keep the same name, description and logo everywhere (GitHub, X, LinkedIn). The structured data links the GitHub repo as `sameAs`.
- [ ] Once downloads open, update the sitemap `lastModified` in `app/sitemap.ts`, flip the structured data availability, and re-request indexing.
