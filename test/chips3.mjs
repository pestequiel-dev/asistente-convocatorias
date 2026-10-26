import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1200 } });
await p.goto("http://127.0.0.1:3100/programa/358", { waitUntil: "networkidle" });
await p.waitForTimeout(1000);
console.log(JSON.stringify(await p.evaluate(() => [...document.querySelectorAll(".badge")].map((b) => ({
  t: b.textContent?.trim().slice(0, 20),
  inHead: !!b.closest(".page-head"),
  parent: b.closest("section, .card")?.className.slice(0, 20),
}))), null, 1));
await b.close();
