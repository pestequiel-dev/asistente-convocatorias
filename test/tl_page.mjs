import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
for (const vp of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  const p = await b.newPage({ viewport: vp });
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));
  p.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 120)); });

  await p.goto("http://127.0.0.1:3100/", { waitUntil: "networkidle" });
  await p.waitForTimeout(900);
  const home = await p.evaluate(() => {
    const sc = document.querySelector(".tl-scroll");
    const m = document.querySelector(".tl-month");
    return {
      hasKpis: !!document.querySelector(".kpis"),
      hasPageHead: !!document.querySelector(".page-head"),
      hasInbox: document.body.innerText.includes("Bandeja de entrada"),
      items: document.querySelectorAll(".tl-item").length,
      months: [...document.querySelectorAll(".tl-month")].map((e) => e.textContent?.trim()),
      scrollH: sc ? sc.scrollHeight : 0,
      clientH: sc ? sc.clientHeight : 0,
      overflowY: sc ? getComputedStyle(sc).overflowY : null,
      sticky: m ? getComputedStyle(m).position : null,
      bodyOverflow: document.documentElement.scrollHeight - window.innerHeight,
      overflowX: document.body.scrollWidth - window.innerWidth,
    };
  });
  console.log(vp.width, "HOME", JSON.stringify(home));

  await p.goto("http://127.0.0.1:3100/resumen", { waitUntil: "networkidle" });
  await p.waitForTimeout(800);
  const sum = await p.evaluate(() => ({
    hasKpis: !!document.querySelector(".kpis"),
    rows: document.querySelectorAll("table.table tbody tr").length,
    title: document.querySelector("h1")?.textContent,
    overflowX: document.body.scrollWidth - window.innerWidth,
  }));
  console.log(vp.width, "RESUMEN", JSON.stringify(sum), "errors:", errors.length ? errors : "none");
  await p.close();
}
await b.close();
