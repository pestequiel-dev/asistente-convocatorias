import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
await p.goto("http://127.0.0.1:3100/", { waitUntil: "networkidle" });
await p.waitForTimeout(1000);
const list = await p.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    if (r.right > window.innerWidth + 1 && r.width > 40) {
      out.push({ tag: el.tagName, cls: (el.className || "").toString().slice(0, 50), w: Math.round(r.width), right: Math.round(r.right) });
    }
  }
  return out.slice(0, 12);
});
console.log(JSON.stringify(list, null, 1));
await b.close();
