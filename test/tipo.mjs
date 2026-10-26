import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1200 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));
await p.goto("http://127.0.0.1:3100/programa/2", { waitUntil: "networkidle" });
await p.waitForTimeout(1000);
const selects = await p.evaluate(() => [...document.querySelectorAll("select.select")].map((s) => ({ v: s.value, opts: s.options.length })));
console.log("selects:", JSON.stringify(selects));
await p.selectOption("select.select >> nth=1", "competidor");
await p.waitForTimeout(1600);
console.log(JSON.stringify(await p.evaluate(() => ({
  chip: document.querySelector(".page-head .badge")?.textContent?.trim(),
  unconfirmed: document.body.innerText.includes("sin confirmar"),
}))), "errors:", errors.length ? errors : "none");
await b.close();
