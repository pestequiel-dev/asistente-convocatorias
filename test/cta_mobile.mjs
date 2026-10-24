import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(() => localStorage.setItem("fs", "1.45"));
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));
await p.goto("http://127.0.0.1:3100/", { waitUntil: "networkidle" });
await p.waitForTimeout(900);
const r = await p.evaluate(() => ({
  ctas: document.querySelectorAll(".tl-cta").length,
  overflow: document.body.scrollWidth - window.innerWidth,
  month: getComputedStyle(document.querySelector(".tl-month")).fontSize,
}));
console.log(JSON.stringify(r), "errors:", errors.length ? errors : "none");
await b.close();
