import { extractFormQuestions } from "../lib/form-questions.ts";
const r = await extractFormQuestions("https://alayacapital.wufoo.com/forms/ztwxral0buwjbz", 381);
console.log(JSON.stringify(r).slice(0, 400));
process.exit(0);
