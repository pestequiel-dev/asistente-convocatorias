import { extractFormQuestions } from "../lib/form-questions.ts";
const r = await extractFormQuestions("https://www.ewor.com/apply", 368);
console.log(JSON.stringify(r).slice(0, 500));
process.exit(0);
