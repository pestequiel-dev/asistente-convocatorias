import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1200 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message.slice(0, 100)));
await p.goto("http://127.0.0.1:3100/programa/2", { waitUntil: "networkidle" });
await p.waitForTimeout(1300);
const before = await p.evaluate(() => [...document.querySelectorAll(".badge")].map((b) => b.textContent?.trim()).slice(0, 8));
// confirmar el tipo
await p.getByRole("button", { name: /sin confirmar/ }).click();
await p.waitForTimeout(1600);
const after = await p.evaluate(() => ({
  badges: [...document.querySelectorAll(".badge")].map((b) => b.textContent?.trim()).slice(0, 8),
  confirmed: document.body.innerText.includes("sin confirmar"),
}));
console.log("antes:", JSON.stringify(before));
console.log("después:", JSON.stringify(after), "errors:", errors.length ? errors : "none");
await b.close();
