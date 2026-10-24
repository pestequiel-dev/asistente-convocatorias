import { extractFormQuestions } from "../lib/form-questions.ts";
const t = Date.now();
const r = await extractFormQuestions("https://forms.gle/EsNhBebaveebpnh26", 227);
console.log(JSON.stringify(r).slice(0, 500));
console.log("ms:", Date.now() - t);
process.exit(0);
