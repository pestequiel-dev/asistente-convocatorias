import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));
await p.goto("http://127.0.0.1:3100/programa/36", { waitUntil: "networkidle" });
await p.waitForTimeout(900);
const r = await p.evaluate(() => ({
  rec: document.querySelector(".rec-title")?.textContent,
  recBody: document.querySelector(".rec-body")?.textContent?.slice(0, 180),
  access: [...document.querySelectorAll(".badge")].map((b) => b.textContent?.trim()).find((t) => /viaje|Virtual|ciudad/i.test(t || "")),
  sede: document.querySelector(".detail-grid")?.innerText.match(/Sede[^\n]*\n?([^\n]*)/)?.[1],
}));
console.log(JSON.stringify(r, null, 1), "errors:", errors.length ? errors : "none");
await b.close();
