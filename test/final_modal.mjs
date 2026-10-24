import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));
p.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 120)); });
await p.goto("http://127.0.0.1:3100/", { waitUntil: "networkidle" });
await p.waitForTimeout(500);
await p.evaluate(() => navigator.clipboard.writeText("https://example.com/convocatoria-2026"));
await p.getByRole("button", { name: /Pegar link/ }).click();
await p.waitForTimeout(400);
const s = await p.evaluate(() => ({
  value: document.querySelector("#qa-url")?.value,
  wobble: document.querySelector(".qa-field")?.className.includes("is-wobbling"),
  btn: [...document.querySelectorAll('[role="dialog"] button')].map((b) => b.textContent?.trim()),
  disabled: [...document.querySelectorAll('[role="dialog"] button')].find((b) => /Analizar/.test(b.textContent||""))?.disabled,
}));
console.log(JSON.stringify(s), "errors:", errors.length ? errors : "none");
await b.close();
