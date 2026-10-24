import { chromium } from "playwright";
import fs from "node:fs";

const exe = fs.existsSync("/Applications/Brave Browser.app/Contents/MacOS/Brave Browser")
  ? "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" : undefined;

const browser = await chromium.launch({ headless: true, ...(exe ? { executablePath: exe } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
const targets = process.argv.slice(2);
for (const [i, t] of targets.entries()) {
  await page.goto(t, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1200);
  const out = `test/shot-${i}.png`;
  await page.screenshot({ path: out, fullPage: true });
  console.log("saved", out, t);
}
await browser.close();
