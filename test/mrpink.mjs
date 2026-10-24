import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message.slice(0, 100)));
await p.goto("http://127.0.0.1:3100/programa/243", { waitUntil: "networkidle" });
await p.waitForTimeout(1200);
const r = await p.evaluate(() => ({
  draft: document.body.innerText.includes("Borrador de postulación"),
  email: document.body.innerText.includes("Email de contacto"),
  contacto: document.body.innerText.includes("mrpink.vc/contacto"),
}));
console.log(JSON.stringify(r), "errors:", errors.length ? errors : "none");
await b.close();
