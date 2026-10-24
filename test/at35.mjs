import { extractFormQuestions } from "../lib/form-questions.ts";
const r = await extractFormQuestions("https://airtable.com/appIl1dxG3hntYW0k/pagWzEH70ZUJuKfvL/form", 35);
console.log(JSON.stringify(r).slice(0, 400));
process.exit(0);
