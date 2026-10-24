import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage();
await p.goto("https://airtable.com/appc0aJ3Qm50q8CrC/shrmSzFCQAxAwnPws", { waitUntil: "domcontentloaded", timeout: 45000 });
await p.waitForTimeout(5000);
const r = await p.evaluate(() => {
  const out = [];
  const inputs = [...document.querySelectorAll("input")].slice(0, 3);
  for (const el of inputs) {
    const chain = [];
    let n = el.parentElement;
    for (let i = 0; i < 6 && n; i++) {
      chain.push({ cls: (n.className || "").toString().slice(0, 40), txt: (n.innerText || "").slice(0, 60).replace(/\n/g, " ") });
      n = n.parentElement;
    }
    out.push({ chain });
  }
  // dónde aparece el texto "Company name"
  const all = [...document.querySelectorAll("div,span,label")].filter((e) => (e.innerText || "").trim().startsWith("Company name"));
  const last = all[all.length - 1];
  return { chain: out, labelEl: last ? { cls: last.className.toString().slice(0, 40), html: last.outerHTML.slice(0, 200) } : null };
});
console.log(JSON.stringify(r, null, 1).slice(0, 2000));
await b.close();
