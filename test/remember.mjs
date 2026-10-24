import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
await p.goto("http://127.0.0.1:3100/resumen", { waitUntil: "networkidle" });
await p.waitForTimeout(900);

await p.getByRole("button", { name: /Inversores/ }).click();
await p.selectOption('select[aria-label="Fit mínimo"]', "70");
await p.selectOption('select[aria-label="Orden"]', "fit_desc");
await p.waitForTimeout(600);

// leave and come back
await p.goto("http://127.0.0.1:3100/", { waitUntil: "networkidle" });
await p.waitForTimeout(400);
await p.goto("http://127.0.0.1:3100/resumen", { waitUntil: "networkidle" });
await p.waitForTimeout(1000);

const r = await p.evaluate(() => ({
  activeTab: [...document.querySelectorAll(".chip.active")].map((c) => c.textContent?.trim()),
  minFit: document.querySelector('select[aria-label="Fit mínimo"]')?.value,
  order: document.querySelector('select[aria-label="Orden"]')?.value,
}));
console.log(JSON.stringify(r));
await b.close();
