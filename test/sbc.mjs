import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage();
for (const url of ["https://startupbootcamp.org/expand", "https://startupbootcamp.org/expand/founders/apply"]) {
  await p.goto(url, { waitUntil: "domcontentloaded", timeout: 40000 }).catch(() => {});
  await p.waitForTimeout(3000);
  const t = await p.evaluate(() => document.body.innerText.replace(/\n+/g, " \n").slice(0, 1200));
  console.log("\n=== ", url, "\n", t.slice(0, 700));
}
await b.close();
