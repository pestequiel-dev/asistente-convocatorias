import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));
await p.goto("http://127.0.0.1:3100/programa/49", { waitUntil: "networkidle" });
await p.waitForTimeout(1200);
await p.getByRole("button", { name: /Preparar email/ }).click();
await p.waitForTimeout(22000);
const r = await p.evaluate(() => {
  const card = [...document.querySelectorAll(".card")].find((c) => c.innerText.includes("Email de contacto"));
  if (!card) return { card: false };
  return {
    card: true,
    to: card.innerText.match(/[\w.+-]+@[\w.-]+/)?.[0],
    subject: card.querySelector("input.input")?.value?.slice(0, 70),
    bodyStart: card.querySelector("textarea.textarea")?.value?.slice(0, 90),
    mailto: card.querySelector('a[href^="mailto:"]')?.getAttribute("href")?.slice(0, 60),
  };
});
console.log(JSON.stringify(r, null, 1), "errors:", errors.length ? errors : "none");
await b.close();
