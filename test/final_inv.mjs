import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));
await p.goto("http://127.0.0.1:3100/resumen", { waitUntil: "networkidle" });
await p.waitForTimeout(700);
await p.getByRole("button", { name: /Inversores/ }).click();
await p.waitForTimeout(500);
const r = await p.evaluate(() => ({
  rows: [...document.querySelectorAll("table.table tbody tr")].map((tr) => tr.innerText.replace(/\n+/g, " | ").slice(0, 90)),
  overflow: document.body.scrollWidth - window.innerWidth,
}));
console.log(JSON.stringify(r, null, 1), "errors:", errors.length ? errors : "none");
await b.close();
