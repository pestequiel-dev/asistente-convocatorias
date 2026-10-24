import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
const checks = [
  ["/", ["Bandeja de entrada", "Convocatorias", "Eventos", "Competidores"]],
  ["/programa/6", ["Datos del evento", "Relevancia", "Call for speakers", "Fecha del evento"]],
  ["/programa/7", ["Lectura competitiva", "Precios", "Cambios desde la última revisión", "Funcionalidades"]],
  ["/programa/5", ["Elegibilidad", "Criterios", "Cierre de postulación"]],
];
for (const [path, needles] of checks) {
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 160)); });
  page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message.slice(0, 160)));
  await page.goto("http://127.0.0.1:3100" + path, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1200);
  const body = await page.evaluate(() => document.body.innerText);
  const missing = needles.filter((n) => !body.includes(n));
  const overflow = await page.evaluate(() => document.body.scrollWidth - window.innerWidth);
  console.log(path, "| missing:", missing.length ? missing : "none", "| overflow:", overflow, "| errors:", errors.length ? errors : "none");
  await page.close();
}
await b.close();
