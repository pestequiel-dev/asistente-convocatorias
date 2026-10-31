import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1200 } });
for (const id of [243, 2]) {
  await p.goto(`http://127.0.0.1:3100/programa/${id}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(900);
  const opts = await p.evaluate(() => [...document.querySelector("select.select").options].map((o) => o.textContent));
  console.log(id, JSON.stringify(opts));
}
await b.close();
