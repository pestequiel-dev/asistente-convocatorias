import { extractFormQuestions } from "../lib/form-questions.ts";
const r = await extractFormQuestions("https://www.f6s.com/mondadori-plai-2026/apply", 372);
console.log(JSON.stringify(r).slice(0, 400));
process.exit(0);
