import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message.slice(0, 100)));
await p.goto("http://127.0.0.1:3100/programa/358", { waitUntil: "networkidle" });
await p.waitForTimeout(1200);
const r = await p.evaluate(() => ({
  rec: document.querySelector(".rec-title")?.textContent,
  badge: [...document.querySelectorAll(".badge")].map((b) => b.textContent?.trim()).find((t) => /elegible|Faltan|estimada|sin verificar/i.test(t || "")),
  crit: document.querySelectorAll(".criterion").length,
}));
console.log(JSON.stringify(r), "errors:", errors.length ? errors : "none");
await b.close();
