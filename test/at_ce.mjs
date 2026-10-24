import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage();
await p.goto("https://airtable.com/appc0aJ3Qm50q8CrC/shrmSzFCQAxAwnPws", { waitUntil: "domcontentloaded", timeout: 45000 });
await p.waitForTimeout(5000);
const r = await p.evaluate(() => {
  const ce = [...document.querySelectorAll('[contenteditable="true"], [role="textbox"]')].map((el) => ({
    tag: el.tagName.toLowerCase(),
    role: el.getAttribute("role"),
    cls: (el.className || "").toString().slice(0, 40),
    label: el.closest(".sharedFormField")?.innerText?.slice(0, 60).replace(/\n/g, " "),
  }));
  return { count: ce.length, ce: ce.slice(0, 10), textareas: document.querySelectorAll("textarea").length };
});
console.log(JSON.stringify(r, null, 1).slice(0, 1500));
await b.close();
