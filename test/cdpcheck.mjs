import { chromium } from "playwright";
const browser = await chromium.connectOverCDP("http://127.0.0.1:9527");
const ctx = browser.contexts()[0];
const page = await ctx.newPage();
await page.goto("https://forms.gle/EsNhBebaveebpnh26", { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(2500);
const info = await page.evaluate(() => ({
  webdriver: navigator.webdriver,
  ua: navigator.userAgent.slice(0, 90),
  title: document.title,
  url: location.href.slice(0, 70),
}));
console.log(JSON.stringify(info, null, 1));
await page.close();
// no cerramos el browser: es del usuario
process.exit(0);
