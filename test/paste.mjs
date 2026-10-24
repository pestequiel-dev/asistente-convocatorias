import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));
await p.goto("http://127.0.0.1:3100/programa/360", { waitUntil: "networkidle" });
await p.waitForTimeout(1300);
const before = await p.evaluate(() => ({
  loginBanner: document.body.innerText.includes("pide iniciar sesión"),
  pasteBtn: [...document.querySelectorAll("button")].some((b) => /Pegar las preguntas/.test(b.textContent || "")),
}));
await p.getByRole("button", { name: /Pegar las preguntas/ }).click();
await p.waitForTimeout(400);
const after = await p.evaluate(() => ({
  textarea: !!document.querySelector("textarea[placeholder*='Una pregunta por línea']"),
  btn: [...document.querySelectorAll("button")].some((b) => /Generar con estas preguntas/.test(b.textContent || "")),
}));
console.log("antes:", JSON.stringify(before), "| después:", JSON.stringify(after), "errors:", errors.length ? errors : "none");
await b.close();
