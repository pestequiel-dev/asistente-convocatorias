import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
await p.goto("http://127.0.0.1:3100/", { waitUntil: "networkidle" });
await p.waitForTimeout(800);
const r = await p.evaluate(() => {
  const sel = [".shell", ".main", ".card", ".inbox-row", ".inbox-row > div:first-child"];
  return sel.map((s) => {
    const el = document.querySelector(s);
    if (!el) return { s, missing: true };
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return { s, w: Math.round(rect.width), flex: cs.flexDirection, minW: cs.minWidth, display: cs.display };
  });
});
console.log(JSON.stringify(r, null, 1));
await b.close();
