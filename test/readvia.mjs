import { extractFormQuestions } from "../lib/form-questions.ts";
const r = await extractFormQuestions("https://forms.gle/EsNhBebaveebpnh26", 227);
console.log(JSON.stringify(r).slice(0, 200));
