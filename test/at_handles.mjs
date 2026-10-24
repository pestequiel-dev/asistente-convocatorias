import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage();
await p.goto("https://airtable.com/appc0aJ3Qm50q8CrC/shrmSzFCQAxAwnPws", { waitUntil: "domcontentloaded", timeout: 45000 });
await p.waitForTimeout(5000);
const r = await p.evaluate(() => ({
  all: document.querySelectorAll('input:not([type="hidden"]), textarea, [role="textbox"]:not(.ql-clipboard), div[contenteditable="true"]:not(.ql-clipboard)').length,
  textboxes: [...document.querySelectorAll('[role="textbox"]')].map((e) => ({ cls: (e.className||"").toString().slice(0,25), ce: e.getAttribute("contenteditable"), label: e.closest(".sharedFormField")?.querySelector("label")?.textContent?.slice(0,40) })),
}));
console.log(JSON.stringify(r, null, 1).slice(0, 900));
await b.close();
