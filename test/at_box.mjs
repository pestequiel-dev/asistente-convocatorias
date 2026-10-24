import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage();
await p.goto("https://airtable.com/appc0aJ3Qm50q8CrC/shrmSzFCQAxAwnPws", { waitUntil: "domcontentloaded", timeout: 45000 });
await p.waitForTimeout(5000);
const r = await p.evaluate(() => {
  const ce = [...document.querySelectorAll('[role="textbox"], div[contenteditable="true"]')].filter((e) => !(e.className||"").toString().includes("ql-clipboard"));
  return ce.map((el) => {
    let n = el;
    for (let i = 0; i < 8 && n; i++) {
      if ((n.className || "").toString().includes("sharedFormField")) break;
      n = n.parentElement;
    }
    return {
      found: !!n,
      cls: (n?.className || "").toString().slice(0, 30),
      labels: [...(n?.querySelectorAll("label") || [])].map((l) => l.textContent?.slice(0, 40)),
      firstChildText: n?.firstElementChild?.textContent?.slice(0, 50),
      txt: (n?.innerText || "").slice(0, 60).replace(/\n/g, " | "),
    };
  });
});
console.log(JSON.stringify(r, null, 1).slice(0, 1500));
await b.close();
