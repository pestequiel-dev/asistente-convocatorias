import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1300 } });
await p.goto("http://127.0.0.1:3100/programa/381", { waitUntil: "networkidle" });
await p.waitForTimeout(1500);
const before = await p.evaluate(() => [...document.querySelectorAll(".card")].find((c) => c.innerText.includes("Borrador de postulación"))?.querySelectorAll(".draft-item").length ?? 0);
await p.getByRole("button", { name: /Leer y generar/ }).click();
await p.waitForTimeout(55000);
const after = await p.evaluate(() => ({
  items: [...document.querySelectorAll(".card")].find((c) => c.innerText.includes("Borrador de postulación"))?.querySelectorAll(".draft-item").length ?? 0,
  first: [...document.querySelectorAll(".draft-item .draft-q")][0]?.textContent?.slice(0, 60),
}));
console.log(JSON.stringify({ before, after }));
await b.close();
