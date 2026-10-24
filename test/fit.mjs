import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));
p.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 120)); });

await p.goto("http://127.0.0.1:3100/resumen", { waitUntil: "networkidle" });
await p.waitForTimeout(1000);

const readRows = () => p.evaluate(() =>
  [...document.querySelectorAll("table.table tbody tr")].map((tr) => {
    const tds = tr.querySelectorAll("td");
    return { title: tds[0]?.innerText.split("\n")[0], fit: (tds[2]?.innerText || "").match(/(\d+)%/)?.[1] ?? null };
  })
);

const all = await readRows();
await p.selectOption('select[aria-label="Fit mínimo"]', "70");
await p.waitForTimeout(400);
const filtered = await readRows();

await p.selectOption('select[aria-label="Fit mínimo"]', "0");
await p.selectOption('select[aria-label="Orden"]', "fit_desc");
await p.waitForTimeout(400);
const desc = (await readRows()).map((r) => Number(r.fit ?? -1));

await p.selectOption('select[aria-label="Orden"]', "fit_asc");
await p.waitForTimeout(400);
const asc = (await readRows()).map((r) => Number(r.fit ?? -1));

console.log("todas:", all.length, "| con fit>=70:", filtered.length, filtered.map((r) => r.fit));
console.log("desc:", desc, "ordenado:", desc.every((v, i, a) => i === 0 || a[i-1] >= v));
console.log("asc :", asc, "ordenado:", asc.every((v, i, a) => i === 0 || a[i-1] <= v));
console.log("errors:", errors.length ? errors : "none");
await b.close();
