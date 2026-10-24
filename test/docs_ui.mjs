import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1200 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message.slice(0, 130)));
await p.goto("http://127.0.0.1:3100/perfil", { waitUntil: "networkidle" });
await p.waitForTimeout(1200);
const r = await p.evaluate(() => ({
  section: document.body.innerText.includes("Documentos de contexto"),
  doc: document.body.innerText.includes("Prueba doc"),
  read: document.body.innerText.includes("leído"),
  overflow: document.body.scrollWidth - window.innerWidth,
}));
console.log(JSON.stringify(r), "errors:", errors.length ? errors : "none");
await b.close();
