import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1300 } });
await p.goto("http://127.0.0.1:3100/programa/243", { waitUntil: "networkidle" });
await p.waitForTimeout(1300);
const areas = await p.evaluate(() => [...document.querySelectorAll("textarea")].map((t) => t.id || t.getAttribute("placeholder")?.slice(0, 30)));
await p.fill("#notas-gestion", "Retomar contacto en marzo 2027 cuando reabran el fondo.");
await p.getByRole("button", { name: /^Guardar$/ }).click();
await p.waitForTimeout(1800);
const r = await p.evaluate(() => ({
  events: [...[...document.querySelectorAll(".card")].find((c) => c.innerText.includes("Historial")).querySelectorAll("li")].map((li) => li.innerText.replace(/\n/g, " ").slice(0, 70)),
}));
console.log("textareas:", JSON.stringify(areas));
console.log(JSON.stringify(r, null, 1));
await b.close();
