// Builds both seeded data dirs into capture/out/seeds/{full,noinbox}.
import { ensureSeed } from "../lib/seeds";

await ensureSeed("full");
await ensureSeed("noinbox");
console.log("seeds ready");
