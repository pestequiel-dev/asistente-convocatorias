import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
await p.goto("http://127.0.0.1:3100/programa/169", { waitUntil: "networkidle" });
await p.waitForTimeout(1200);
const r = await p.evaluate(() => ({
  rec: document.querySelector(".rec-title")?.textContent,
  cuba: document.body.innerText.includes("Cuba"),
  badge: [...document.querySelectorAll(".badge")].map((b) => b.textContent?.trim()).find((t) => /Elegible|Faltan|No eleg/.test(t || "")),
}));
console.log(JSON.stringify(r));
await b.close();
