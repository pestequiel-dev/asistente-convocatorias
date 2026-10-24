import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));
await p.goto("http://127.0.0.1:3100/programa/355", { waitUntil: "networkidle" });
await p.waitForTimeout(1500);
const r = await p.evaluate(() => ({
  editables: document.querySelectorAll("textarea.draft-edit").length,
  buttons: [...document.querySelectorAll("button")].map((b) => b.textContent?.trim()).filter((t) => /Ya la envié|Guardar|Abrir pre-cargado/.test(t || "")),
  overflow: document.body.scrollWidth - window.innerWidth,
}));
console.log(JSON.stringify(r), "errors:", errors.length ? errors : "none");
await b.close();
