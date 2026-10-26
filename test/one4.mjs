import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1300 } });
await p.goto("http://127.0.0.1:3100/programa/243", { waitUntil: "networkidle" });
await p.waitForTimeout(1300);
console.log(JSON.stringify(await p.evaluate(() => ({
  areas: [...document.querySelectorAll("textarea")].map((t) => ({ id: t.id, ph: t.getAttribute("placeholder"), card: t.closest(".card")?.innerText.slice(0, 40).replace(/\n/g, " ") })),
  buttons: [...document.querySelectorAll("button")].map((b) => b.textContent?.trim()).filter((t) => /Guardar/.test(t || "")),
})), null, 1));
await b.close();
