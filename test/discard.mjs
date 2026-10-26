import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1200 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message.slice(0, 100)));
await p.goto("http://127.0.0.1:3100/programa/362", { waitUntil: "networkidle" });
await p.waitForTimeout(1000);
await p.getByRole("button", { name: /Descartar$/ }).click();
await p.waitForTimeout(400);
await p.fill("#motivo-descarte", "El plazo venció y no aplico a la próxima edición.");
await p.getByRole("button", { name: /Descartar con motivo/ }).click();
await p.waitForTimeout(1800);
const r = await p.evaluate(() => ({
  chip: [...document.querySelectorAll(".page-head .badge")].map((b) => b.textContent?.trim()).find((t) => /Descart/i.test(t || "")),
  history: [...[...document.querySelectorAll(".card")].find((c) => c.innerText.includes("Historial")).querySelectorAll("li")].map((li) => li.innerText.replace(/\n/g, " ").slice(0, 70)).slice(0, 2),
}));
console.log(JSON.stringify(r, null, 1), "errors:", errors.length ? errors : "none");
await b.close();
