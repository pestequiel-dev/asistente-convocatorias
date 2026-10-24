import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage();
await p.goto("http://127.0.0.1:3100/perfil", { waitUntil: "networkidle" });
await p.waitForTimeout(1000);
console.log("textarea:", await p.$$eval("textarea", (ts) => ts.map((t) => t.value).filter(Boolean)));
console.log("selects:", await p.$$eval("select", (ss) => ss.map((s) => s.value)));
await b.close();
