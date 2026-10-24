import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  const p = await b.newPage({ viewport: vp });
  await p.goto("http://127.0.0.1:3100/", { waitUntil: "networkidle" });
  await p.waitForTimeout(900);
  const read = async () => p.evaluate(() => {
    const g = (s) => { const el = document.querySelector(s); return el ? getComputedStyle(el).fontSize : null; };
    const weights = new Set();
    for (const el of document.querySelectorAll("body *")) {
      const w = getComputedStyle(el).fontWeight;
      if (Number(w) >= 600) weights.add(w);
    }
    return {
      fs: getComputedStyle(document.documentElement).getPropertyValue("--fs").trim(),
      body: getComputedStyle(document.body).fontSize,
      month: g(".tl-month"), title: g(".tl-title"), nav: g(".nav-item"),
      bold: [...weights],
      overflowX: document.body.scrollWidth - window.innerWidth,
      overflowY: document.documentElement.scrollHeight - window.innerHeight,
    };
  });
  const base = await read();
  await p.getByRole("button", { name: "Texto muy grande" }).click();
  await p.waitForTimeout(400);
  const big = await read();
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(800);
  const afterReload = await read();
  console.log(vp.width, "base:", JSON.stringify(base));
  console.log(vp.width, "A++ :", JSON.stringify(big));
  console.log(vp.width, "reload:", JSON.stringify(afterReload));
  await p.close();
}
await b.close();
