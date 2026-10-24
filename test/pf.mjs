import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage();
await p.goto("https://imagineventures.tech/startups/", { waitUntil: "domcontentloaded", timeout: 30000 });
await p.waitForTimeout(2500);
const links = await p.evaluate(() => [...document.querySelectorAll("a[href]")].map(a => ({ t: (a.innerText||"").trim().slice(0,30), img: a.querySelector("img")?.getAttribute("alt") || "", h: a.href })).filter(x => !x.h.includes("imagineventures") && !x.h.includes("linkedin.com/company/imagine")).slice(0, 20));
console.log(JSON.stringify(links, null, 1));
await b.close();
