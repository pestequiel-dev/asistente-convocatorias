import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
for (const path of ["/programa/5", "/programa/6", "/programa/7"]) {
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  await p.goto("http://127.0.0.1:3100" + path, { waitUntil: "networkidle" });
  await p.waitForTimeout(600);
  const heads = await p.$$eval("h2", (els) => els.map((e) => e.innerText));
  console.log(path, "→", heads.join(" | "));
  await p.close();
}
await b.close();
