import { extractFormQuestions } from "../lib/form-questions.ts";
const qs = await extractFormQuestions("https://www.globantventures.com/");
console.log(JSON.stringify(qs, null, 1));
