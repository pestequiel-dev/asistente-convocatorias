import { chromium } from "playwright";
import { fillForm } from "../lib/prefill.ts";

const answers = [
  { question: "¿Cuál es el problema que resuelven?", answer: "PROBLEMA: el seguimiento 1:1 en aulas de 40 no escala." },
  { question: "¿Cómo lo resuelven? Describí el producto.", answer: "PRODUCTO: entrada por voz, sin pantallas." },
  { question: "¿Qué tracción tienen hoy?", answer: "TRACCION: producto en producción y 2 clientes." },
  { question: "¿Quiénes son sus clientes y cómo ganan dinero?", answer: "CLIENTES: colegios; suscripción anual." },
  { question: "¿Cuál es el mercado y por qué ahora?", answer: "MERCADO: 200.000 docentes en Argentina." },
];

const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage();
await p.goto("http://127.0.0.1:8899/form.html", { waitUntil: "networkidle" }).catch(async () => {
  await p.setContent(`<h1>fallback</h1>`);
});
await p.waitForTimeout(500);
const res = await fillForm(p, answers);
const values = await p.evaluate(() => [...document.querySelectorAll("input,textarea")].map((el) => ({ id: el.id, v: el.value.slice(0, 40) })));
console.log("resultado:", JSON.stringify(res));
console.log("valores:", JSON.stringify(values, null, 1));
await b.close();
