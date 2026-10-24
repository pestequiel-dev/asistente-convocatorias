import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message.slice(0, 140)));

await p.goto("http://127.0.0.1:3100/mensajeros", { waitUntil: "networkidle" });
await p.waitForTimeout(800);
await p.locator("textarea").first().fill("Queremos difundir evaluaciones formativas con IA en secundaria.");
await p.getByRole("button", { name: /Seleccionar/ }).click();
await p.waitForTimeout(9000);
const sel = await p.evaluate(() => ({
  items: document.querySelectorAll(".sel-item").length,
  badges: [...document.querySelectorAll(".sel-item .badge")].slice(0, 4).map((e) => e.textContent?.trim()),
  hasMessage: document.body.innerText.includes("Hola"),
}));
console.log("selección:", JSON.stringify(sel));

await p.goto("http://127.0.0.1:3100/mensajeros/1", { waitUntil: "networkidle" });
await p.waitForTimeout(700);
await p.locator('textarea[placeholder^="Qué pasó"]').fill("Le escribí por Instagram y respondió interesada.");
await p.getByRole("button", { name: /Registrar/ }).click();
await p.waitForTimeout(1500);
const hist = await p.evaluate(() => ({
  hasEntry: document.body.innerText.includes("Le escribí por Instagram"),
  count: document.body.innerText.match(/contacto\(s\)/)?.[0],
}));
console.log("historial:", JSON.stringify(hist));
console.log("errors:", errors.length ? errors : "none");
await b.close();
