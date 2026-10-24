import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));

await p.goto("http://127.0.0.1:3100/perfil", { waitUntil: "networkidle" });
await p.waitForTimeout(1000);
const fields = await p.evaluate(() => ({
  inputs: [...document.querySelectorAll("input")].length,
  labels: [...document.querySelectorAll("label")].map((l) => l.textContent?.trim()).filter((t) => /LinkedIn|Teléfono|Rol|Email|Nombre del fundador|Apellido/.test(t || "")),
}));

await p.goto("http://127.0.0.1:3100/programa/227", { waitUntil: "networkidle" });
await p.waitForTimeout(1500);
const banner = await p.evaluate(() => document.body.innerText.match(/El prefill no puede completar[^\n]*/)?.[0] ?? null);

console.log("perfil:", JSON.stringify(fields));
console.log("aviso faltantes:", banner);
console.log("errors:", errors.length ? errors : "none");
await b.close();
