import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
for (const vp of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  const ctx = await b.newContext({ viewport: vp });
  await ctx.addInitScript(() => localStorage.setItem("fs", "1.45"));
  for (const path of ["/mensajeros", "/mensajeros/1"]) {
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));
    p.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 120)); });
    await p.goto("http://127.0.0.1:3100" + path, { waitUntil: "networkidle" });
    await p.waitForTimeout(900);
    const r = await p.evaluate(() => ({
      h1: document.querySelector("h1")?.textContent,
      rows: document.querySelectorAll("table.table tbody tr").length,
      overflowX: document.body.scrollWidth - window.innerWidth,
      hasForm: !!document.querySelector(".form-grid"),
      touch: document.body.innerText.includes("Historial"),
    }));
    console.log(vp.width, path, JSON.stringify(r), "errors:", errors.length ? errors : "none");
    await p.close();
  }
  await ctx.close();
}
await b.close();
