import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage();
await p.goto("http://127.0.0.1:3100/perfil", { waitUntil: "networkidle" });
await p.waitForTimeout(1200);
const opts = await p.$$eval("select", (sels) =>
  sels.map((s) => ({ value: s.value, options: [...s.options].map((o) => o.textContent.trim()) }))
);
console.log(JSON.stringify(opts.filter(o => o.options.some(x => /legal|Otra|factura/i.test(x))), null, 1));
await b.close();
