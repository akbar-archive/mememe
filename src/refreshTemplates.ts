import { writeFile } from "node:fs/promises";
import { CURATED_TEMPLATES, PATHS } from "./config";
import { curateTemplates, ImgflipClient } from "./imgflip";

// get_memes needs no login, so no credentials here.
const client = new ImgflipClient("", "");
const templates = curateTemplates(await client.listTopTemplates(), CURATED_TEMPLATES);
await writeFile(PATHS.templates, JSON.stringify(templates, null, 2) + "\n");
console.log(`saved ${templates.length} templates to ${PATHS.templates}`);

const found = new Set(templates.map((t) => t.name.toLowerCase()));
const missing = CURATED_TEMPLATES.filter((name) => !found.has(name.toLowerCase()));
if (missing.length > 0) console.warn(`not in imgflip's current top 100: ${missing.join(", ")}`);
