import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1300 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message.slice(0, 100)));
await p.goto("http://127.0.0.1:3100/programa/243", { waitUntil: "networkidle" });
await p.waitForTimeout(1500);
const before = await p.evaluate(() => ({
  forms: [...document.querySelectorAll("textarea")].length,
  historyButtons: [...document.querySelectorAll(".card")].filter((c) => c.innerText.includes("Historial")).flatMap((c) => [...c.querySelectorAll("button")]).length,
  estado: document.querySelector("select.select")?.value,
  enviada: [...document.querySelectorAll(".badge")].map((b) => b.textContent?.trim()).find((t) => /Postulación/.test(t || "")),
  events: [...document.querySelectorAll(".card")].find((c) => c.innerText.includes("Historial"))?.querySelectorAll("li").length,
}));
// guardar estado + nota en un solo paso
await p.fill("textarea", "No están invirtiendo en este momento; retomar en 2027.");
await p.getByRole("button", { name: /^Guardar$/ }).click();
await p.waitForTimeout(1800);
const after = await p.evaluate(() => ({
  events: [...document.querySelectorAll(".card")].find((c) => c.innerText.includes("Historial"))?.querySelectorAll("li").length,
  last: [...document.querySelectorAll(".card")].find((c) => c.innerText.includes("Historial"))?.querySelector("li")?.innerText.replace(/\n/g, " ").slice(0, 80),
}));
console.log(JSON.stringify({ before, after }, null, 1), "errors:", errors.length ? errors : "none");
await b.close();
