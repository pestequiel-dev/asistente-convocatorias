import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1300 } });
await p.goto("http://127.0.0.1:3100/programa/243", { waitUntil: "networkidle" });
await p.waitForTimeout(1300);
const txt = "Retomar contacto en marzo 2027 cuando reabran el fondo.";
await p.fill("textarea", txt);
await p.getByRole("button", { name: /^Guardar$/ }).click();
await p.waitForTimeout(1800);
console.log(JSON.stringify(await p.evaluate(() => ({
  events: [...[...document.querySelectorAll(".card")].find((c) => c.innerText.includes("Historial")).querySelectorAll("li")].map((li) => li.innerText.replace(/\n/g, " ").slice(0, 70)),
}))));
await b.close();
