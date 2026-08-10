/**
 * Reproducible speed comparison against other highlighters. Run with
 * `npm run benchmark`; add `-- --write` to update the README's Benchmark
 * section. Runs as part of `npm run build`, so the published numbers come
 * from the machine of the last build (named in the output header).
 *
 * Fairness rules: identical inputs (examples/languages/), warm runs with all
 * grammars preloaded, HTML-string output for every library, Shiki on its
 * JavaScript regex engine. Cold start (import + first highlight) is measured
 * separately, in this order, before anything is warmed up.
 *
 * File-size sweep: real per-language example files are tiny, so larger files
 * are synthesized by tiling (repeating and slicing) each language's example
 * up to a target byte size. The same tiled input is used for every library,
 * so it stays fair even though the tail of a tiled file can cut mid-token.
 *
 * Precision: every ops/min figure is the median of several repeated trials
 * (see TRIALS/TRIAL_MS below) rather than a single sample, since a lone
 * short window is noisy enough to make library-to-library comparisons
 * unreliable. Rates are reported per minute rather than per second since
 * the huge bucket can drop below 1 op/sec for the slower libraries.
 *
 * Multi-language rows: each corpus language is timed in its own slice of
 * the trial window, and the resulting per-language ops/min figures are
 * summed. Pooling ops and time across languages before dividing once would
 * average like a harmonic mean, letting whichever language is slowest
 * dominate the total; summing independent rates instead keeps one slow
 * grammar from disproportionately dragging down the combined figure.
 */

import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const output = [];
const print = line => {
	output.push(line);
	console.log(line);
};

// languages every benched library supports out of the box
const corpus = [
	['js', 'javascript'],
	['css', 'css'],
	['json', 'json'],
	['md', 'markdown'],
	['sql', 'sql'],
	['py', 'python'],
	['bash', 'bash'],
].map(([shj, common]) => ({
	shj,
	common,
	code: fs.readFileSync(path.join(root, `examples/languages/test.${shj}`), 'utf8'),
}));

// file sizes to sweep, approximating what you'd encounter in the wild, from
// a single snippet up to a large generated/bundled file. "huge" is capped at
// 128 KB rather than going bigger: beyond that, Prism's bash grammar shows
// non-linear (cubic-ish) backtracking blowup (~14s for one highlight call at
// 128 KB, 100s+ at 256 KB), which would make this script impractically slow
// to run in CI.
const SIZE_BUCKETS = [
	{ label: 'tiny', bytes: 1024 },
	{ label: 'medium', bytes: 16384 },
	{ label: 'huge', bytes: 131072 },
];

const fmtBytes = bytes => (bytes >= 1024 ? `${bytes / 1024} KB` : `${bytes} B`);
const bucketLabel = ({ label, bytes }) => `${label} (${fmtBytes(bytes)})`;

// repeats (and slices) text up to targetChars, so every bucket size has real
// syntax to highlight instead of e.g. padding with whitespace
const tileToSize = (text, targetChars) =>
	text.length >= targetChars ? text.slice(0, targetChars) : text.repeat(Math.ceil(targetChars / text.length)).slice(0, targetChars);

const corpusAtSize = bytes => corpus.map(file => ({ ...file, code: tileToSize(file.code, bytes) }));

const timeMs = async fn => {
	const start = performance.now();
	await fn();
	return performance.now() - start;
};

const TRIALS = 9; // odd, so the median is a real sample rather than an average of two
const TRIAL_MS = 400; // per-trial measurement window

// warm ops/min over one trial window: each file gets its own equal slice of
// the window and its own ops/min figure, and those figures are summed.
// Pooling ops and time across files first (one division at the end) would
// produce a harmonic-mean-style average dominated by whichever language is
// slowest; summing independent per-language rates instead means one slow
// grammar in the corpus can't disproportionately drag down the total.
const bench = async (fn, files, trialMs = TRIAL_MS) => {
	const sliceMs = trialMs / files.length;
	let totalOpsPerMin = 0;
	for (const file of files) {
		let ops = 0;
		const start = performance.now();
		while (performance.now() - start < sliceMs) {
			await fn(file);
			ops++;
		}
		totalOpsPerMin += ops / ((performance.now() - start) / 60000);
	}
	return Math.round(totalOpsPerMin);
};

const median = xs => {
	const sorted = [...xs].sort((a, b) => a - b);
	return sorted[(sorted.length - 1) >> 1];
};

// repeats bench() TRIALS times (sequentially, to avoid contention skewing results) and takes the median ops/min
const benchMedian = async (fn, files, trialMs = TRIAL_MS) => {
	const samples = [];
	for (let t = 0; t < TRIALS; t++) samples.push(await bench(fn, files, trialMs));
	return median(samples);
};

const fmtMs = ms => `${ms >= 10 ? ms.toFixed(0) : ms.toFixed(1)} ms`;
const fmtOps = ops => `${ops.toLocaleString('en-US')} ops/min`;

const NAME_WIDTH = 22;
const COL_WIDTH = 19; // fits ops/min figures up to 9,999,999 without breaking column alignment

const rowCold = (name, ms) => print(`${name.padEnd(NAME_WIDTH)}${fmtMs(ms).padStart(COL_WIDTH)}`);
const rowHeader = (label, cols) => print(`${label.padEnd(NAME_WIDTH)}${cols.map(c => c.padStart(COL_WIDTH)).join('')}`);
const rowData = (name, values) => print(`${name.padEnd(NAME_WIDTH)}${values.map(v => fmtOps(v).padStart(COL_WIDTH)).join('')}`);

// ---- cold start: import + first highlight of test.js, nothing warmed yet, not size-swept
// (this is inherently a one-shot event, repeating/bucketing it wouldn't measure anything real)

const jsSample = corpus[0].code;
const cold = {};

cold['speed-highlight'] = await timeMs(async () => {
	const { highlightHTML } = await import('../dist/index.js');
	await highlightHTML(jsSample, 'js');
});

cold['highlight.js'] = await timeMs(async () => {
	const hljs = (await import('highlight.js/lib/core')).default;
	hljs.registerLanguage('javascript', (await import('highlight.js/lib/languages/javascript')).default);
	hljs.highlight(jsSample, { language: 'javascript' });
});

cold['prismjs'] = await timeMs(async () => {
	const Prism = require('prismjs');
	Prism.highlight(jsSample, Prism.languages.javascript, 'javascript');
});

cold['shiki (js engine)'] = await timeMs(async () => {
	const { createHighlighter } = await import('shiki');
	const { createJavaScriptRegexEngine } = await import('shiki/engine/javascript');
	const highlighter = await createHighlighter({
		themes: ['github-light'],
		langs: ['javascript'],
		engine: createJavaScriptRegexEngine(),
	});
	highlighter.codeToHtml(jsSample, { lang: 'javascript', theme: 'github-light' });
});

cold['sugar-high (js only)'] = await timeMs(async () => {
	(await import('sugar-high')).highlight(jsSample);
});

// ---- warm setup

const { highlightHTML } = await import('../dist/index.js');

const hljs = (await import('highlight.js/lib/core')).default;
for (const { common } of corpus)
	hljs.registerLanguage(common, (await import(`highlight.js/lib/languages/${common}`)).default);

const Prism = require('prismjs');
for (const component of ['json', 'markdown', 'sql', 'python', 'bash'])
	require(`prismjs/components/prism-${component}`);

const { createHighlighter } = await import('shiki');
const { createJavaScriptRegexEngine } = await import('shiki/engine/javascript');
const shiki = await createHighlighter({
	themes: ['github-light'],
	langs: corpus.map(({ common }) => common),
	engine: createJavaScriptRegexEngine(),
});

const sugarHigh = (await import('sugar-high')).highlight;

// warm every library on the full corpus once (grammar loading, JIT priming)
for (const file of corpus) {
	await highlightHTML(file.code, file.shj);
	hljs.highlight(file.code, { language: file.common });
	Prism.highlight(file.code, Prism.languages[file.common], file.common);
	shiki.codeToHtml(file.code, { lang: file.common, theme: 'github-light' });
}
sugarHigh(jsSample);

// ---- output

print(`node ${process.version}, ${os.platform()} ${os.arch()}${os.cpus()[0] ? `, ${os.cpus()[0].model}` : ''}`);
print(
	`corpus: ${corpus.map(({ shj }) => shj).join(', ')}, tiled to ${SIZE_BUCKETS.length} sizes (${SIZE_BUCKETS.map(bucketLabel).join(' / ')}), median of ${TRIALS} trials per cell\n`,
);

const libraryFns = {
	'speed-highlight': file => highlightHTML(file.code, file.shj),
	'prismjs': file => Prism.highlight(file.code, Prism.languages[file.common], file.common),
	'highlight.js': file => hljs.highlight(file.code, { language: file.common }),
	'shiki (js engine)': file => shiki.codeToHtml(file.code, { lang: file.common, theme: 'github-light' }),
	'sugar-high (js only)': file => sugarHigh(file.code),
};

// name -> bucket label -> median ops/min
const warmByBucket = Object.fromEntries(Object.keys(libraryFns).map(name => [name, {}]));

for (const bucket of SIZE_BUCKETS) {
	const files = corpusAtSize(bucket.bytes);
	const jsFiles = [{ code: tileToSize(jsSample, bucket.bytes) }];
	for (const [name, fn] of Object.entries(libraryFns)) {
		const useFiles = name === 'sugar-high (js only)' ? jsFiles : files;
		await fn(useFiles[0]); // warm up on this size profile before timing
		warmByBucket[name][bucket.label] = await benchMedian(fn, useFiles);
	}
}

const orderedNames = Object.keys(libraryFns).sort((a, b) => warmByBucket[b][SIZE_BUCKETS[0].label] - warmByBucket[a][SIZE_BUCKETS[0].label]);

rowHeader('', SIZE_BUCKETS.map(bucketLabel));
for (const name of orderedNames) rowData(name, SIZE_BUCKETS.map(bucket => warmByBucket[name][bucket.label]));

print(`\ncold start (import + first highlight of test.js):`);
for (const name of orderedNames) rowCold(name, cold[name]);

print(`\nspeed-highlight per language (warm, median of ${TRIALS} trials):`);
rowHeader('', SIZE_BUCKETS.map(bucketLabel));
for (const file of corpus) {
	const values = [];
	for (const bucket of SIZE_BUCKETS) {
		const files = [{ ...file, code: tileToSize(file.code, bucket.bytes) }];
		await highlightHTML(files[0].code, files[0].shj);
		values.push(await benchMedian(f => highlightHTML(f.code, f.shj), files));
	}
	rowData(file.shj, values);
}

if (process.argv.includes('--write')) {
	const readmePath = path.join(root, 'README.md');
	const block = '```rb\n$ npm run benchmark\n' + output.join('\n') + '\n```';
	const re = /(<!-- AUTOGENERATED:BENCHMARK:START[^\n]*-->)[\s\S]*?(<!-- AUTOGENERATED:BENCHMARK:END -->)/;
	const readme = fs.readFileSync(readmePath, 'utf8');
	if (!re.test(readme))
		throw new Error('Could not find "AUTOGENERATED:BENCHMARK" markers in README.md');
	fs.writeFileSync(readmePath, readme.replace(re, `$1\n${block}\n$2`));
	console.log('\nREADME.md benchmark section updated');
}
