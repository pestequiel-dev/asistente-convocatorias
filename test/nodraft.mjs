import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1100 } });
const check = async (url) => {
  await p.goto(url, { waitUntil: "networkidle" });
  await p.waitForTimeout(1000);
  return p.evaluate(() => ({
    draft: document.body.innerText.includes("Borrador de postulación"),
    email: document.body.innerText.includes("Email de contacto"),
  }));
};
console.log("49 (solo email):", JSON.stringify(await check("http://127.0.0.1:3100/programa/49")));
console.log("355 (con form):", JSON.stringify(await check("http://127.0.0.1:3100/programa/355")));
await b.close();
