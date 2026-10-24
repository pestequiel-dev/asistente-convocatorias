import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
await p.goto("http://127.0.0.1:3100/resumen", { waitUntil: "networkidle" });
await p.waitForTimeout(900);
await p.selectOption('select[aria-label="Fit mínimo"]', "85");
await p.waitForTimeout(600);
const r = await p.evaluate(() => {
  const rows = [...document.querySelectorAll("table.table tbody tr")];
  return {
    total: rows.length,
    hasWOW: rows.some((tr) => /WOW/i.test(tr.innerText)),
    min: Math.min(...rows.map((tr) => Number((tr.querySelectorAll("td")[2]?.innerText || "").match(/(\d+)%/)?.[1] ?? 999))),
  };
});
console.log(JSON.stringify(r));
await b.close();
