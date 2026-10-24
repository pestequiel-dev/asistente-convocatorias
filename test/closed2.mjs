import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
await p.goto("http://127.0.0.1:3100/programa/49", { waitUntil: "networkidle" });
await p.waitForTimeout(800);
const before = await p.evaluate(() => document.querySelector("select.select")?.value);
await p.selectOption("select.select", "closed");
await p.waitForTimeout(1500);
const after = await p.evaluate(() => ({
  value: document.querySelector("select.select")?.value,
  badge: [...document.querySelectorAll(".badge")].map((b) => b.textContent?.trim()).includes("Cerrado"),
}));
console.log("antes:", before, "| después:", JSON.stringify(after));
// restaurar
await p.selectOption("select.select", "reviewing");
await p.waitForTimeout(800);
await b.close();
