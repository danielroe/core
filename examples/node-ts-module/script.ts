import { highlightANSI, ShjLanguage } from "@speed-highlight/core";
import theme from "@speed-highlight/core/themes/atom-dark.js";
import { readFile } from "fs/promises";

const lang: ShjLanguage = process.argv[2] as ShjLanguage ?? 'js';
const code = await readFile(`../languages/test.${lang}`, "utf-8");

console.log(await highlightANSI(code, lang, theme));
