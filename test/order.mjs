import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1200 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message.slice(0, 100)));
for (const id of [243, 2]) {
  await p.goto(`http://127.0.0.1:3100/programa/${id}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1000);
  const r = await p.evaluate(() => [...document.querySelectorAll(".detail-grid > .stack > *")].map((e) => (e.querySelector("h2, .rec-title, .kpi-label")?.textContent || e.className).trim().slice(0, 30)));
  console.log(id, JSON.stringify(r));
}
console.log("errors:", errors.length ? errors : "none");
await b.close();
