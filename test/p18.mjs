import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));
p.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 120)); });
await p.goto("http://127.0.0.1:3100/programa/18", { waitUntil: "networkidle" });
await p.waitForTimeout(1000);
const r = await p.evaluate(() => {
  const links = [...document.querySelectorAll("a")].map((a) => a.href);
  return {
    hasApply: links.some((l) => l.includes("aplica.500.co")),
    hasContact: links.some((l) => l.includes("connect/strategic-partnerships")),
    text: document.querySelector(".detail-grid")?.innerText.includes("Contacto / consultas"),
    overflow: document.body.scrollWidth - window.innerWidth,
  };
});
console.log(JSON.stringify(r), "errors:", errors.length ? errors : "none");
await b.close();
