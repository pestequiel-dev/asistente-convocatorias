import { fetchPreview } from "../lib/classify.ts";
const p = await fetchPreview("https://noexcuses.get.tech/");
console.log(JSON.stringify({ title: p.title, len: (p.text||"").length, text: (p.text||"").slice(0, 300) }));
process.exit(0);
