import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1300 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));
await p.goto("http://127.0.0.1:3100/programa/368", { waitUntil: "networkidle" });
await p.waitForTimeout(1200);
await p.fill("#notas-gestion", "PRUEBA: aceptan equipos de dos fundadores.");
const box = p.locator('input[type="checkbox"]').first();
await box.check();
await p.getByRole("button", { name: /^Guardar$/ }).click();
await p.waitForTimeout(6000);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(1500);
const r = await p.evaluate(() => ({
  notas: document.querySelector("#notas-gestion")?.value?.slice(0, 60),
  events: [...[...document.querySelectorAll(".card")].find((c) => c.innerText.includes("Historial"))?.querySelectorAll("li") || []].map((li) => li.innerText.replace(/\n/g, " ").slice(0, 60)).slice(0, 3),
}));
console.log(JSON.stringify(r, null, 1), "errors:", errors.length ? errors : "none");
await b.close();
