import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));
await p.goto("http://127.0.0.1:3100/programa/35", { waitUntil: "networkidle" });
await p.waitForTimeout(900);
const r = await p.evaluate(() => {
  const chips = [...document.querySelectorAll(".pf-chip")];
  return {
    total: document.querySelectorAll(".badge").length,
    links: chips.map((a) => ({ text: a.textContent?.trim(), href: a.getAttribute("href") })),
    allChips: [...document.querySelectorAll(".detail-grid .panel-body .badge")].map((x) => x.textContent?.trim()).slice(-14),
    overflow: document.body.scrollWidth - window.innerWidth,
  };
});
console.log(JSON.stringify(r, null, 1), "errors:", errors.length ? errors : "none");
await b.close();
