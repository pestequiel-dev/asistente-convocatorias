import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage();
await p.goto("https://airtable.com/appc0aJ3Qm50q8CrC/shrmSzFCQAxAwnPws", { waitUntil: "domcontentloaded", timeout: 45000 });
await p.waitForTimeout(5000);
const info = await p.evaluate(() => ({
  url: location.href.slice(0, 90),
  title: document.title.slice(0, 80),
  inputs: document.querySelectorAll("input,textarea,select").length,
  text: document.body.innerText.slice(0, 250).replace(/\n+/g, " | "),
}));
console.log(JSON.stringify(info, null, 1));
await b.close();
