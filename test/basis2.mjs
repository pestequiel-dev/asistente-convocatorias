import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage();
await p.goto("https://basisfellowship.org/apply", { waitUntil: "domcontentloaded", timeout: 40000 });
await p.waitForTimeout(3000);
const info = await p.evaluate(() => {
  return [...document.querySelectorAll("input,textarea,select")].slice(0, 10).map((el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      tag: el.tagName, type: el.getAttribute("type"),
      w: Math.round(r.width), h: Math.round(r.height),
      display: cs.display, vis: cs.visibility, opacity: cs.opacity,
      parentText: (el.parentElement?.innerText || "").slice(0, 40).replace(/\n/g, " "),
    };
  });
});
console.log(JSON.stringify(info, null, 1));
await b.close();
