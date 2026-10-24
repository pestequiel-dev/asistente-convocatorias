import { extractFormQuestions } from "../lib/form-questions.ts";
const r = await extractFormQuestions("https://airtable.com/appc0aJ3Qm50q8CrC/shrmSzFCQAxAwnPws", 211);
console.log(JSON.stringify(r).slice(0, 600));
process.exit(0);
