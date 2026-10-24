import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));
await p.goto("http://127.0.0.1:3100/programa/227", { waitUntil: "networkidle" });
await p.waitForTimeout(1500);
const r = await p.evaluate(() => ({
  banner: document.querySelector(".banner-warn")?.innerText.replace(/\n+/g, " | ").slice(0, 200),
  buttons: [...document.querySelectorAll(".banner-warn button")].map((b) => b.textContent?.trim()),
  answers: document.querySelectorAll(".draft-item").length,
}));
console.log(JSON.stringify(r, null, 1), "errors:", errors.length ? errors : "none");
await b.close();
