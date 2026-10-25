import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1100 } });
await p.goto("http://127.0.0.1:3100/programa/13", { waitUntil: "networkidle" });
await p.waitForTimeout(1200);
const r = await p.evaluate(() => ({
  rec: document.querySelector(".rec-title")?.textContent,
  body: document.querySelector(".rec-body")?.textContent?.slice(0, 120),
  badges: [...document.querySelectorAll(".badge")].map((b) => b.textContent?.trim()).slice(0, 8),
  select: document.querySelector("select.select")?.value,
}));
console.log(JSON.stringify(r, null, 1));
await b.close();
