import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));

await p.goto("http://127.0.0.1:3100/programa/35", { waitUntil: "networkidle" });
await p.waitForTimeout(900);
const detail = await p.evaluate(() => ({
  actions: [...document.querySelectorAll(".page-head .actions a, .page-head .actions button")].map((e) => e.textContent?.trim()),
  href: [...document.querySelectorAll(".page-head .actions a")].map((a) => a.getAttribute("href")),
}));

await p.goto("http://127.0.0.1:3100/", { waitUntil: "networkidle" });
await p.waitForTimeout(800);
const tl = await p.evaluate(() => ({
  ctas: [...document.querySelectorAll(".tl-cta")].map((e) => e.textContent?.trim()).slice(0, 8),
  overflow: document.body.scrollWidth - window.innerWidth,
}));
console.log("detail:", JSON.stringify(detail, null, 1));
console.log("timeline:", JSON.stringify(tl));
console.log("errors:", errors.length ? errors : "none");
await b.close();
