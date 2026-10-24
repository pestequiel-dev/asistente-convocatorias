import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://127.0.0.1:9318");
const ctx = b.contexts()[0];
console.log("páginas abiertas:");
for (const pg of ctx.pages()) console.log(" -", pg.url().slice(0, 90));
process.exit(0);
