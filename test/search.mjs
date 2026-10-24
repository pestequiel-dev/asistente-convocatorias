import { findLiveAlternative } from "../lib/search.ts";
const r = await findLiveAlternative("https://www.socialab.com/");
console.log(JSON.stringify(r, null, 1));
