import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage();
await p.goto("https://alayacapital.wufoo.com/forms/ztwxral0buwjbz", { waitUntil: "domcontentloaded", timeout: 40000 }).catch(() => {});
await p.waitForTimeout(3000);
console.log(JSON.stringify(await p.evaluate(() => [...document.querySelectorAll("input,textarea")].map((el) => ({
  tag: el.tagName.toLowerCase(), type: el.getAttribute("type"), id: el.id,
  aria: el.getAttribute("aria-label")?.slice(0, 40),
  labelFor: el.id ? document.querySelector(`label[for="${el.id}"]`)?.textContent?.slice(0, 60) : null,
  ph: el.getAttribute("placeholder")?.slice(0, 30),
}))), null, 1).slice(0, 1500));
await b.close();
