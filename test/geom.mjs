import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
await p.goto("http://127.0.0.1:3100/programa/49", { waitUntil: "networkidle" });
await p.waitForTimeout(1200);
const m = await p.evaluate(() => {
  const head = [...document.querySelectorAll(".panel-head")].find((h) => h.innerText.includes("Email de contacto"));
  const card = head.closest(".card");
  const h2 = head.querySelector("h2").getBoundingClientRect();
  const mail = head.querySelector(".tiny").getBoundingClientRect();
  const btn = head.querySelector("button").getBoundingClientRect();
  const c = card.getBoundingClientRect();
  return {
    cardTop: Math.round(c.top), cardLeft: Math.round(c.left),
    h2Top: Math.round(h2.top), h2Left: Math.round(h2.left),
    mailTop: Math.round(mail.top),
    gapTituloEmail: Math.round(mail.top - h2.bottom),
    btnTop: Math.round(btn.top), btnRight: Math.round(c.right - btn.right),
    padIzq: Math.round(h2.left - c.left),
  };
});
console.log(JSON.stringify(m));
await b.close();
