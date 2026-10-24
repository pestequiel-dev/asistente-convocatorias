import { chromium } from "playwright";
const browser = await chromium.connectOverCDP("http://127.0.0.1:9527");
const page = await (browser.contexts()[0]).newPage();
await page.goto("https://example.com", { waitUntil: "domcontentloaded" });
await page.evaluate("window.__name = window.__name || function (f) { return f };");
try {
  const r = await page.evaluate(() => (typeof __name) + ":" + (typeof __name === "function" ? __name(() => 1, "x")() : "n/a"));
  console.log("ok:", r);
} catch (e) {
  console.log("fail:", e.message.slice(0, 120));
}
await page.close();
process.exit(0);
