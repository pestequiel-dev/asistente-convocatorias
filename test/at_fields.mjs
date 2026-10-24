import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage();
await p.goto("https://airtable.com/appc0aJ3Qm50q8CrC/shrmSzFCQAxAwnPws", { waitUntil: "domcontentloaded", timeout: 45000 });
await p.waitForTimeout(5000);
const fields = await p.evaluate(() => [...document.querySelectorAll("input,textarea")].map((el) => ({
  tag: el.tagName.toLowerCase(),
  type: el.getAttribute("type"),
  aria: el.getAttribute("aria-label"),
  ph: el.getAttribute("placeholder"),
  label: el.closest("label")?.innerText?.slice(0, 50),
  prev: el.previousElementSibling?.innerText?.slice(0, 50),
  parent: el.parentElement?.innerText?.slice(0, 60)?.replace(/\n/g, " "),
})));
console.log(JSON.stringify(fields, null, 1).slice(0, 1800));
await b.close();
