import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1200 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));
await p.goto("http://127.0.0.1:3100/programa/2", { waitUntil: "networkidle" });
await p.waitForTimeout(1000);
await p.getByRole("button", { name: /sin confirmar/ }).click();
await p.waitForTimeout(500);
const opened = await p.evaluate(() => ({
  select: document.querySelector('select[aria-label="Tipo definitivo"]')?.value,
  confirmBtn: [...document.querySelectorAll("button")].some((b) => b.textContent?.trim() === "Confirmar"),
}));
await p.selectOption('select[aria-label="Tipo definitivo"]', "competidor");
await p.getByRole("button", { name: /^Confirmar$/ }).click();
await p.waitForTimeout(1600);
const after = await p.evaluate(() => ({
  kindChip: document.querySelector(".page-head .badge")?.textContent?.trim(),
  stillUnconfirmed: document.body.innerText.includes("sin confirmar"),
}));
console.log(JSON.stringify({ opened, after }, null, 1), "errors:", errors.length ? errors : "none");
await b.close();
