const fs = require('fs'),
	path = require('path'),
	{ printHighlight } = require('@speed-highlight/core/terminal');

const lang = process.argv[2] ?? 'js';
const code = fs.readFileSync(path.resolve(__dirname, `../languages/test.${lang}`));

printHighlight(code, lang);
