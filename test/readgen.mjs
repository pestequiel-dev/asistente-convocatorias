import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1300 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));
await p.goto("http://127.0.0.1:3100/programa/211", { waitUntil: "networkidle" });
await p.waitForTimeout(1500);
const before = await p.evaluate(() => {
  const card = [...document.querySelectorAll(".card")].find((c) => c.innerText.includes("Borrador de postulación"));
  return { items: card?.querySelectorAll(".draft-item").length ?? 0, header: card?.innerText.split("\n")[1]?.slice(0, 60) };
});
await p.fill("#form-url", "https://airtable.com/appc0aJ3Qm50q8CrC/shrmSzFCQAxAwnPws");
await p.getByRole("button", { name: /Leer y generar/ }).click();
await p.waitForTimeout(45000);
const after = await p.evaluate(() => {
  const card = [...document.querySelectorAll(".card")].find((c) => c.innerText.includes("Borrador de postulación"));
  return { items: card?.querySelectorAll(".draft-item").length ?? 0, header: card?.innerText.split("\n")[1]?.slice(0, 60) };
});
console.log(JSON.stringify({ before, after }, null, 1), "errors:", errors.length ? errors : "none");
await b.close();
