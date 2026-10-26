import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1200 } });
for (const id of [2, 243]) {
  await p.goto(`http://127.0.0.1:3100/programa/${id}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1000);
  const r = await p.evaluate(() => [...document.querySelectorAll(".page-head .row > *")].map((e) => e.textContent?.trim()).slice(0, 8));
  console.log(id, JSON.stringify(r));
}
await b.close();
