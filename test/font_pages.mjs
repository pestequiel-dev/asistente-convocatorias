import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  const ctx = await b.newContext({ viewport: vp });
  await ctx.addInitScript(() => localStorage.setItem("fs", "1.45"));
  for (const path of ["/", "/resumen", "/programa/3", "/perfil", "/ajustes", "/nueva"]) {
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message.slice(0, 100)));
    p.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 100)); });
    await p.goto("http://127.0.0.1:3100" + path, { waitUntil: "networkidle" });
    await p.waitForTimeout(700);
    const r = await p.evaluate(() => {
      const nav = [...document.querySelectorAll(".nav-item")];
      return {
        ox: document.body.scrollWidth - window.innerWidth,
        navWrap: nav.some((e) => e.scrollWidth > e.clientWidth + 1),
        smallest: Math.min(...[...document.querySelectorAll("body *")].map((e) => parseFloat(getComputedStyle(e).fontSize)).filter((n) => n > 0)),
      };
    });
    console.log(vp.width, path, JSON.stringify(r), "errors:", errors.length ? errors.length : 0);
    await p.close();
  }
  await ctx.close();
}
await b.close();
