import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));
await p.goto("http://127.0.0.1:3100/programa/358", { waitUntil: "networkidle" });
await p.waitForTimeout(1200);
const r = await p.evaluate(() => ({
  h1: document.querySelector("h1")?.textContent?.slice(0, 80),
  rec: document.querySelector(".rec-title")?.textContent,
  recBody: document.querySelector(".rec-body")?.textContent?.slice(0, 160),
  badges: [...document.querySelectorAll(".badge")].slice(0, 6).map((b) => b.textContent?.trim()),
  evidence: document.querySelectorAll(".criterion").length,
  overflow: document.body.scrollWidth - window.innerWidth,
}));
console.log(JSON.stringify(r, null, 1), "errors:", errors.length ? errors : "none");
await b.close();
