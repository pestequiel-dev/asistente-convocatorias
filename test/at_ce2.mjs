import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage();
await p.goto("https://airtable.com/appc0aJ3Qm50q8CrC/shrmSzFCQAxAwnPws", { waitUntil: "domcontentloaded", timeout: 45000 });
await p.waitForTimeout(5000);
const r = await p.evaluate(() => {
  const els = [...document.querySelectorAll('[role="textbox"][contenteditable="true"]')];
  return els.map((el) => {
    const chain = [];
    let n = el.parentElement;
    for (let i = 0; i < 4 && n; i++) { chain.push((n.innerText || "").slice(0, 50).replace(/\n/g, " ")); n = n.parentElement; }
    return { id: el.id, cls: (el.className||"").toString().slice(0,30), chain };
  });
});
console.log(JSON.stringify(r, null, 1).slice(0, 1200));
await b.close();
