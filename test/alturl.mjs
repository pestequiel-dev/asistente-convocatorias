import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));
await p.goto("http://127.0.0.1:3100/programa/289", { waitUntil: "networkidle" });
await p.waitForTimeout(900);
const hasField = await p.locator("#alt-url").isVisible().catch(() => false);
await p.locator("#alt-url").fill("https://comunidad.socialab.com/es");
await p.getByRole("button", { name: /Analizar esta URL/ }).click();
await p.waitForTimeout(6000);
const state = await p.evaluate(() => ({
  url: location.pathname,
  analyzing: document.body.innerText.includes("Analizando convocatoria"),
  error: document.body.innerText.includes("El análisis falló"),
}));
console.log("campo visible:", hasField, "| estado:", JSON.stringify(state), "| errors:", errors.length ? errors : "none");
await b.close();
