import { chromium } from "playwright";
import { fillForm } from "../lib/prefill.ts";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage();
await p.goto("https://basisfellowship.org/apply", { waitUntil: "domcontentloaded", timeout: 40000 });
await p.waitForTimeout(3000);
const all = await p.$$("input, textarea, select");
const filtered = await p.$$('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea, select');
console.log("all:", all.length, "filtered:", filtered.length);
let visible = 0;
for (const h of filtered) if (await h.isVisible()) visible++;
console.log("visible:", visible);
const res = await fillForm(p, [
  { label: "nombre", aliases: ["first name"], value: "Juan" },
  { label: "ciudad", aliases: ["city"], value: "Tigre" },
  { label: "pais", aliases: ["country"], value: "Argentina" },
]);
console.log("fillForm:", JSON.stringify(res));
const vals = await p.evaluate(() => [...document.querySelectorAll("input")].slice(0, 6).map((i) => i.value));
console.log("valores:", JSON.stringify(vals));
await b.close();
