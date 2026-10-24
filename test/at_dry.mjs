import { chromium } from "playwright";
import { fillForm } from "../lib/prefill.ts";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage();
await p.addInitScript({ content: "window.__name = window.__name || function (f) { return f };" });
await p.goto("https://airtable.com/appc0aJ3Qm50q8CrC/shrmSzFCQAxAwnPws", { waitUntil: "domcontentloaded", timeout: 45000 });
await p.waitForTimeout(4000);
const values = [
  { label: "empresa", aliases: ["company", "startup"], value: "Mehmiro" },
  { label: "sitio web", aliases: ["website", "web", "url", "site"], value: "https://mehmiro.com" },
  { label: "linkedin", value: "https://linkedin.com/in/x" },
  { label: "email", value: "a@b.com" },
  { label: "Round Size *", value: "USD 500k" },
  { label: "Valuation (Pre-Money) *", value: "USD 4M" },
];
const r = await fillForm(p, values, { dryRun: true });
console.log(JSON.stringify(r.matches, null, 1));
await b.close();
