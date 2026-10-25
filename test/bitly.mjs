import { resolveShortUrl } from "../lib/shortlinks.ts";
const r = await resolveShortUrl("https://bit.ly/3FPWvXF");
console.log("destino:", r);
process.exit(0);
