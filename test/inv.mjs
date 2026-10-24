import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));
p.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 120)); });

await p.goto("http://127.0.0.1:3100/programa/32", { waitUntil: "networkidle" });
await p.waitForTimeout(900);
const inv = await p.evaluate(() => ({
  heads: [...document.querySelectorAll("h2")].map((e) => e.textContent),
  body: document.querySelector(".detail-grid")?.innerText.slice(0, 280).replace(/\n+/g, " | "),
}));

await p.goto("http://127.0.0.1:3100/resumen", { waitUntil: "networkidle" });
await p.waitForTimeout(700);
const tabs = await p.evaluate(() => [...document.querySelectorAll(".chip")].map((c) => c.textContent?.trim()).filter(Boolean).slice(0, 8));
console.log("investor page:", JSON.stringify(inv, null, 1));
console.log("tabs:", JSON.stringify(tabs));
console.log("errors:", errors.length ? errors : "none");
await b.close();
