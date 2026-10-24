import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const ctx = await b.newContext({ viewport: { width: 1440, height: 1100 }, permissions: ["clipboard-read", "clipboard-write"] });
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));
await p.goto("http://127.0.0.1:3100/programa/355", { waitUntil: "networkidle" });
await p.waitForTimeout(1500);
const r = await p.evaluate(() => ({
  heads: [...document.querySelectorAll("h2")].map((h) => h.textContent).filter((t) => /Borrador|Postulaci/.test(t || "")),
  items: document.querySelectorAll(".draft-item").length,
  hasCopy: [...document.querySelectorAll("button")].some((b) => /Copiar/.test(b.textContent || "")),
  hasOpen: [...document.querySelectorAll("a")].some((a) => /Abrir formulario/.test(a.textContent || "")),
  warn: document.body.innerText.match(/Hay \d+ respuesta/)?.[0],
  overflow: document.body.scrollWidth - window.innerWidth,
}));
console.log(JSON.stringify(r, null, 1), "errors:", errors.length ? errors : "none");
await b.close();
