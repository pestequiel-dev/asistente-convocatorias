import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message.slice(0, 140)));
p.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 140)); });

await p.goto("http://127.0.0.1:3100/programa/3", { waitUntil: "networkidle" });
await p.waitForTimeout(1000);

const before = await p.evaluate(() => ({
  rec: document.querySelector(".rec-title")?.textContent,
  body: document.querySelector(".rec-body")?.textContent?.slice(0, 90),
}));

const btn = p.getByRole("button", { name: /Aportar el dato/ }).first();
await btn.click();
await p.waitForTimeout(300);

const opened = await p.evaluate(() => {
  const ta = document.querySelector(".crit-form textarea");
  return { hasTextarea: !!ta, focused: document.activeElement?.tagName, placeholder: ta?.getAttribute("placeholder")?.slice(0, 60) };
});

await p.locator(".crit-form textarea").fill("La propuesta es original y fue desarrollada íntegramente por el equipo fundador.");
await p.getByRole("button", { name: /Re-analizar con este dato/ }).click();
await p.waitForTimeout(6000);

const after = await p.evaluate(() => ({
  rec: document.querySelector(".rec-title")?.textContent,
  body: document.querySelector(".rec-body")?.textContent?.slice(0, 90),
  notes: [...document.querySelectorAll(".crit-note")].map((e) => e.textContent?.slice(0, 70)),
  badges: [...document.querySelectorAll(".criterion .badge")].map((e) => e.textContent?.trim()).slice(0, 8),
}));

console.log("BEFORE:", JSON.stringify(before));
console.log("OPENED:", JSON.stringify(opened));
console.log("AFTER :", JSON.stringify(after, null, 1));
console.log("errors:", errors.length ? errors : "none");
await b.close();
