import { chromium } from "playwright";
import { fillForm } from "../lib/prefill.ts";
const browser = await chromium.connectOverCDP("http://127.0.0.1:9527");
const page = await (browser.contexts()[0]).newPage();
await page.addInitScript({ content: "window.__name = window.__name || function (f) { return f };" });
await page.goto("https://forms.gle/EsNhBebaveebpnh26", { waitUntil: "domcontentloaded", timeout: 40000 });
await page.waitForTimeout(3000);
const values = [
  { label: "nombre", aliases: ["first name"], value: "X" },
  { label: "apellido", aliases: ["last name"], value: "X" },
  { label: "email", aliases: ["e-mail"], value: "X" },
  { label: "telefono", aliases: ["phone", "mobile", "whatsapp", "teléfono"], value: "X" },
  { label: "linkedin", value: "X" },
  { label: "rol", aliases: ["role", "title", "position", "cargo"], value: "X" },
  { label: "What is your mission? *", value: "MISSION-X" },
  { label: "Why are you pursuing this opportunity? *", value: "WHY-X" },
  { label: "Which industry are you operating in? *", value: "INDUSTRY-X" },
  { label: "What have you achieved so far? *", value: "ACHIEVED-X" },
  { label: "Anything else you would like to share?", value: "ELSE-X" },
];
const r = await fillForm(page, values, { dryRun: true });
console.log(JSON.stringify(r.matches, null, 1));
await page.close();
process.exit(0);
