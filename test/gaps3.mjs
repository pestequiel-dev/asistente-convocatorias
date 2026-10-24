import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));
await p.goto("http://127.0.0.1:3100/programa/174", { waitUntil: "networkidle" });
await p.waitForTimeout(1400);
const r = await p.evaluate(() => ({
  banner: document.querySelector(".banner-warn")?.innerText.replace(/\n+/g, " | "),
  chips: document.querySelectorAll(".gap-chip").length,
  buttons: [...document.querySelectorAll(".banner-warn button")].map((b) => b.textContent?.trim()),
}));
await p.getByRole("button", { name: /Ir al primero/ }).click();
await p.waitForTimeout(500);
const sel = await p.evaluate(() => ({ tag: document.activeElement?.tagName, sel: document.activeElement?.value?.slice(document.activeElement.selectionStart, document.activeElement.selectionEnd) }));
console.log(JSON.stringify(r), "\nclick:", JSON.stringify(sel), "errors:", errors.length ? errors : "none");
await b.close();
