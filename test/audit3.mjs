import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
for (const path of ["/", "/programa/2", "/programa/3", "/programa/4", "/nueva", "/perfil", "/ajustes"]) {
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 140)); });
  page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message.slice(0, 140)));
  await page.goto("http://127.0.0.1:3100" + path, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1000);
  const info = await page.evaluate(() => ({
    overflow: document.body.scrollWidth - window.innerWidth,
    inbox: document.body.innerText.includes("Bandeja de entrada"),
    labels: [...document.querySelectorAll(".badge")].slice(0, 6).map((e) => e.textContent?.trim()),
  }));
  console.log(path, JSON.stringify(info), "errors:", errors.length ? errors : "none");
  await page.close();
}
await b.close();
