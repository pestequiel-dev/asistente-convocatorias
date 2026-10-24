import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } }); // localStorage vacío
const p = await ctx.newPage();
await p.goto("http://127.0.0.1:3100/resumen", { waitUntil: "networkidle" });
await p.waitForTimeout(900);
console.log("primera visita:", JSON.stringify(await p.evaluate(() => ({
  tab: [...document.querySelectorAll(".chip.active")].map((c) => c.textContent?.trim()),
  minFit: document.querySelector('select[aria-label="Fit mínimo"]')?.value,
  order: document.querySelector('select[aria-label="Orden"]')?.value,
}))));
await b.close();
