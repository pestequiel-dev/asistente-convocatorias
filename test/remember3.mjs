import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const read = () => p.evaluate(() => ({
  tab: [...document.querySelectorAll(".chip.active")].map((c) => c.textContent?.trim()),
  minFit: document.querySelector('select[aria-label="Fit mínimo"]')?.value,
  order: document.querySelector('select[aria-label="Orden"]')?.value,
  stored: localStorage.getItem("resumen-filtros"),
}));

await p.goto("http://127.0.0.1:3100/resumen", { waitUntil: "networkidle" });
await p.waitForTimeout(800);
await p.getByRole("button", { name: /Inversores/ }).click();
await p.selectOption('select[aria-label="Fit mínimo"]', "70");
await p.selectOption('select[aria-label="Orden"]', "fit_desc");
await p.waitForTimeout(700);
console.log("después de setear:", JSON.stringify(await read()));

// navegación por el menú, como un usuario
await p.getByRole("link", { name: "Panel" }).click();
await p.waitForTimeout(700);
await p.getByRole("link", { name: "Resumen" }).click();
await p.waitForTimeout(900);
console.log("al volver por el menú:", JSON.stringify(await read()));

// recarga completa
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(900);
console.log("tras recargar:", JSON.stringify(await read()));
await b.close();
