import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
await p.goto("http://127.0.0.1:3100/programa/302", { waitUntil: "networkidle" });
await p.waitForTimeout(1200);
console.log(JSON.stringify(await p.evaluate(() => [...document.querySelectorAll(".badge")].map((b) => b.textContent?.trim()).slice(0, 8))));
await b.close();
