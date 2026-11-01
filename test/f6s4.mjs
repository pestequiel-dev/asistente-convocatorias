import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1300 } });
await p.goto("http://127.0.0.1:3100/programa/372", { waitUntil: "networkidle" });
await p.waitForTimeout(2000);
console.log(JSON.stringify(await p.evaluate(() => ({
  blockedBanner: document.body.innerText.includes("bloquea el acceso automático"),
  openBtn: [...document.querySelectorAll("button")].some((b) => /Abrir en navegador normal/.test(b.textContent || "")),
  pasteBtn: [...document.querySelectorAll("button")].some((b) => /Pegar las preguntas/.test(b.textContent || "")),
  formField: !!document.querySelector("#form-url"),
}))));
await b.close();
