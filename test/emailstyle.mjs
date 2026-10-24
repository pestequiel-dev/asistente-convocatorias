import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1100 } });
await p.goto("http://127.0.0.1:3100/programa/49", { waitUntil: "networkidle" });
await p.waitForTimeout(1000);
const r = await p.evaluate(() => {
  const head = [...document.querySelectorAll(".panel-head")].find((h) => h.innerText.includes("Email de contacto"));
  const card = head?.closest(".card");
  const body = card?.querySelector(".panel-body");
  const cs = (el) => el ? getComputedStyle(el) : null;
  return {
    head: cs(head) && { pad: cs(head).padding, border: cs(head).borderBottomWidth },
    body: cs(body) && { pad: cs(body).padding },
    cardRadius: cs(card)?.borderRadius,
    headHasButtons: !!head?.querySelector("button"),
  };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
