import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
await p.goto("http://127.0.0.1:3100/programa/5", { waitUntil: "networkidle" });
await p.waitForTimeout(800);
console.log((await p.evaluate(() => document.body.innerText)).slice(0, 2500));
await b.close();
