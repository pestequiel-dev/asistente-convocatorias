import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
for (const url of ["https://altaventures.com/", "https://www.arkfund.co/"]) {
  const p = await b.newPage();
  await p.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
  await p.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
  await p.waitForTimeout(1200);
  const t = await p.evaluate(() => document.body?.innerText || "");
  console.log(url, "→ chars:", t.length, "|", t.slice(0, 120).replace(/\n/g, " "));
  await p.close();
}
await b.close();
