const fs = require('fs'),
	path = require('path'),
	{ highlightText } = require('@speed-highlight/core/terminal');

const lang = process.argv[2] ?? 'js';
const code = fs.readFileSync(path.resolve(__dirname, `../languages/test.${lang}`));

console.log(await highlightText(code.toString(), lang));
