import { extractFormQuestions } from "../lib/form-questions.ts";
const r = await extractFormQuestions("https://latam.aplica.500.co/", 18);
console.log(JSON.stringify(r).slice(0, 300));
process.exit(0);
