import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const opts = async (url) => {
  await p.goto(url, { waitUntil: "networkidle" });
  await p.waitForTimeout(900);
  return p.evaluate(() => {
    const sel = document.querySelector("select.select");
    return sel ? [...sel.options].map((o) => o.textContent) : null;
  });
};
console.log("convocatoria:", JSON.stringify(await opts("http://127.0.0.1:3100/programa/355")));
console.log("inversor:", JSON.stringify(await opts("http://127.0.0.1:3100/programa/49")));
await b.close();
