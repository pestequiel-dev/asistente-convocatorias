import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1200 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message.slice(0, 100)));
await p.goto("http://127.0.0.1:3100/programa/364", { waitUntil: "networkidle" });
await p.waitForTimeout(1200);
const r = await p.evaluate(() => ({
  rec: document.querySelector(".rec-title")?.textContent,
  body: document.querySelector(".rec-body")?.textContent?.slice(0, 130),
  crit: [...document.querySelectorAll(".criterion")].map((c) => c.innerText.replace(/\n+/g, " | ").slice(0, 70)),
}));
await p.goto("http://127.0.0.1:3100/perfil", { waitUntil: "networkidle" });
await p.waitForTimeout(800);
const ded = await p.evaluate(() => {
  const s = [...document.querySelectorAll("select")].find((x) => [...x.options].some((o) => o.textContent?.includes("Tiempo completo")));
  return s ? s.value : null;
});
console.log(JSON.stringify({ ...r, dedication: ded }, null, 1), "errors:", errors.length ? errors : "none");
await b.close();
