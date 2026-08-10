const fs = require('fs'),
	path = require('path'),
	{ highlightANSI } = require('@speed-highlight/core'),
	{ default: theme } = require('@speed-highlight/core/themes/default.js');

const lang = process.argv[2] ?? 'js';
const code = fs.readFileSync(path.resolve(__dirname, `../languages/test.${lang}`));

console.log(await highlightANSI(code.toString(), lang, theme));
