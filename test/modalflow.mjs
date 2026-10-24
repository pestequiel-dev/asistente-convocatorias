import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ["clipboard-read", "clipboard-write"] });
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message.slice(0, 140)));
p.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 140)); });

await p.goto("http://127.0.0.1:3100/", { waitUntil: "networkidle" });
await p.waitForTimeout(500);
await p.evaluate(() => navigator.clipboard.writeText("http://127.0.0.1:8899/evento.html"));
await p.getByRole("button", { name: /Pegar link/ }).click();
await p.waitForTimeout(300);
await p.getByRole("button", { name: /^Analizar$/ }).click();

for (const t of [300, 1000, 3000, 8000]) {
  await p.waitForTimeout(t === 300 ? 300 : t - 300);
  const s = await p.evaluate(() => ({
    url: location.pathname,
    modal: !!document.querySelector('[role="dialog"]'),
    btn: [...document.querySelectorAll('[role="dialog"] button')].map((b) => b.textContent?.trim()),
    status: document.body.innerText.match(/Analizando[^\n]*/g)?.slice(0, 2),
  }));
  console.log(t + "ms:", JSON.stringify(s));
}
console.log("errors:", errors.length ? errors : "none");
await b.close();
