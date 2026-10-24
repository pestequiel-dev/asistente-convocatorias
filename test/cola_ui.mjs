import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));
p.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 120)); });
await p.goto("http://127.0.0.1:3100/cola", { waitUntil: "networkidle" });
await p.waitForTimeout(1200);
const r = await p.evaluate(() => ({
  h1: document.querySelector("h1")?.textContent,
  cards: [...document.querySelectorAll(".kpi")].map((k) => k.innerText.replace(/\n+/g, " ").slice(0, 40)),
  worker: document.body.innerText.includes("worker activo"),
  overflow: document.body.scrollWidth - window.innerWidth,
}));
console.log(JSON.stringify(r, null, 1), "errors:", errors.length ? errors : "none");
await b.close();
