export const SITE_URL = (process.env.SITE_URL ?? "https://opendot.live").replace(/\/$/, "");

/** True only for the real production deployment. Local builds count as production; Vercel previews do not. */
export const IS_PRODUCTION = (process.env.VERCEL_ENV ?? "production") === "production";

/** IndexNow ownership key. The same string is served at /<key>.txt (see public/). */
export const INDEXNOW_KEY = "a254c54260beb0dcc3ed1204998e9b30";

/** Pages that appear in the sitemap and are submitted to IndexNow. */
export const SITE_PATHS = ["/", "/privacy"] as const;
