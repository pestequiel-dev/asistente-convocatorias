import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message.slice(0, 100)));
await p.goto("http://127.0.0.1:3100/", { waitUntil: "networkidle" });
await p.waitForTimeout(1200);
const r = await p.evaluate(() => {
  const items = [...document.querySelectorAll(".tl-meta")].slice(0, 4);
  return items.map((m) => [...m.querySelectorAll(".badge")].map((b) => b.textContent?.trim()));
});
console.log(JSON.stringify(r), "errors:", errors.length ? errors : "none");
await b.close();
