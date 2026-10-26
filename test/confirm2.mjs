import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1200 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message.slice(0, 100)));
await p.goto("http://127.0.0.1:3100/programa/13", { waitUntil: "networkidle" });
await p.waitForTimeout(1000);
const before = await p.evaluate(() => document.body.innerText.includes("sin confirmar"));
await p.getByRole("button", { name: /^Guardar$/ }).click();
await p.waitForTimeout(1600);
const after = await p.evaluate(() => ({
  unconfirmed: document.body.innerText.includes("sin confirmar"),
  chips: [...document.querySelectorAll(".badge")].map((b) => b.textContent?.trim()).slice(0, 7),
}));
console.log("antes sin confirmar:", before, "| después:", JSON.stringify(after), "errors:", errors.length ? errors : "none");
await b.close();
