import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1300 } });
await p.goto("http://127.0.0.1:3100/programa/372", { waitUntil: "networkidle" });
await p.waitForTimeout(2000);
console.log(JSON.stringify(await p.evaluate(() => ({
  text: document.body.innerText.slice(0, 400).replace(/\n+/g, " | "),
  inputs: [...document.querySelectorAll("input")].map((i) => i.id || i.placeholder?.slice(0, 20)).slice(0, 8),
})), null, 1));
await b.close();
