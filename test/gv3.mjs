import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));
await p.goto("http://127.0.0.1:3100/programa/174", { waitUntil: "networkidle" });
await p.waitForTimeout(1400);
const r = await p.evaluate(() => ({
  answers: document.querySelectorAll(".draft-item").length,
  genericWarn: document.body.innerText.includes("No pude leer las preguntas"),
  cta: [...document.querySelectorAll(".page-head .actions a")].map((a) => ({ t: a.textContent?.trim(), h: a.getAttribute("href")?.slice(0, 60) })),
  overflow: document.body.scrollWidth - window.innerWidth,
}));
console.log(JSON.stringify(r, null, 1), "errors:", errors.length ? errors : "none");
await b.close();
