import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1100 } });
await p.goto("http://127.0.0.1:3100/programa/355", { waitUntil: "networkidle" });
await p.waitForTimeout(1500);
const before = await p.evaluate(() => document.querySelectorAll(".gap-chip").length);
await p.getByRole("button", { name: /^Completar$/ }).first().click();
await p.waitForTimeout(400);
await p.keyboard.type("fotografía analógica");
await p.getByRole("button", { name: /^Guardar$/ }).click();
await p.waitForTimeout(1200);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(1500);
const after = await p.evaluate(() => ({
  chips: document.querySelectorAll(".gap-chip").length,
  hasText: document.body.innerText.includes("fotografía analógica"),
}));
console.log("gaps antes:", before, "| después de completar y guardar:", JSON.stringify(after));
await b.close();
