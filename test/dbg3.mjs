import { chromium } from "playwright";
const browser = await chromium.connectOverCDP("http://127.0.0.1:9527");
const page = await (browser.contexts()[0]).newPage();
await page.goto("https://example.com", { waitUntil: "domcontentloaded" });
await page.evaluate("window.__name = window.__name || function (f) { return f };");
try {
  const r = await page.evaluate(() => { const push = (t) => t; return "ok:" + push(1); });
  console.log(r);
} catch (e) { console.log("fail:", e.message.slice(0, 100)); }
await page.close();
process.exit(0);
