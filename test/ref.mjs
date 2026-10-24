import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));
await p.goto("http://127.0.0.1:3100/programa/20", { waitUntil: "networkidle" });
await p.waitForTimeout(900);
const detail = await p.evaluate(() => ({
  card: document.querySelector(".detail-grid")?.innerText.slice(0, 320),
  hasNavDump: document.body.innerText.includes("Pasar al contenido principal"),
}));
await p.goto("http://127.0.0.1:3100/resumen", { waitUntil: "networkidle" });
await p.waitForTimeout(700);
await p.getByRole("button", { name: /Referencias/ }).click();
await p.waitForTimeout(500);
const tab = await p.evaluate(() => ({
  rows: document.querySelectorAll("table.table tbody tr").length,
  hasCleanBtn: document.body.innerText.includes("Vaciar referencias"),
}));
console.log("detail:", JSON.stringify(detail, null, 1));
console.log("tab:", JSON.stringify(tab), "errors:", errors.length ? errors : "none");
await b.close();
