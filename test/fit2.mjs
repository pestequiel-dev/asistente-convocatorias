import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1100 } });
await p.goto("http://127.0.0.1:3100/resumen", { waitUntil: "networkidle" });
await p.waitForTimeout(900);
const read = () => p.evaluate(() => [...document.querySelectorAll("table.table tbody tr")].map((tr) => {
  const m = (tr.querySelectorAll("td")[2]?.innerText || "").match(/(\d+)%/);
  return m ? Number(m[1]) : null;
}));
await p.selectOption('select[aria-label="Orden"]', "fit_asc");
await p.waitForTimeout(400);
const rows = await read();
const scored = rows.filter((x) => x !== null);
const nullsAtEnd = rows.slice(rows.indexOf(null)).every((x) => x === null);
console.log("total:", rows.length, "| con score:", scored.length, "| primeros:", scored.slice(0, 8), "| últimos:", scored.slice(-5));
console.log("ascendente:", scored.every((v, i, a) => i === 0 || a[i-1] <= v), "| nulos al final:", nullsAtEnd);
await b.close();
