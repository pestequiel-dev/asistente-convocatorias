import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1200 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message.slice(0, 100)));
await p.goto("http://127.0.0.1:3100/perfil", { waitUntil: "networkidle" });
await p.waitForTimeout(1200);
const r = await p.evaluate(() => {
  const section = [...document.querySelectorAll("section.card")].find((s) => s.innerText.includes("Mercado y tracción"));
  const areas = [...(section?.querySelectorAll("textarea") || [])];
  return { section: !!section, fields: areas.length, first: areas[0]?.value?.slice(0, 60), overflow: document.body.scrollWidth - window.innerWidth };
});
console.log(JSON.stringify(r), "errors:", errors.length ? errors : "none");
await b.close();
