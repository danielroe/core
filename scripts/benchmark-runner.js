/**
 * Measures a single highlighter and reports its numbers back over IPC. Forked
 * once per library by scripts/benchmark.js; running it directly does nothing
 * unless given `--measure <library>`.
 *
 * One library per process is what keeps the comparison honest: cold start is
 * the first thing the process does, so nothing is warmed, and the warm figures
 * aren't measured against a heap holding four other libraries' grammars.
 *
 * Fairness rules: identical inputs (examples/languages/), warm runs with all
 * grammars preloaded, HTML-string output for every library, Shiki on its
 * JavaScript regex engine.
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
 * Combined rows: every language is timed on its own, and a library's figure
 * for a size is the average of those per-language medians, so each cell is
 * measured exactly once and the combined rows are derived from the same
 * samples as the per-language rows. Averaging independent rates is not the
 * same as pooling ops and time across languages before dividing once: that
 * would average like a harmonic mean, letting whichever language is slowest
 * dominate the total.
 */

import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// languages every benched library supports out of the box
export const corpus = [
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
export const SIZE_BUCKETS = [
	{ label: 'tiny', bytes: 1024 },
	{ label: 'medium', bytes: 16384 },
	{ label: 'huge', bytes: 131072 },
];

const fmtBytes = bytes => (bytes >= 1024 ? `${bytes / 1024} KB` : `${bytes} B`);
export const bucketLabel = ({ label, bytes }) => `${label} (${fmtBytes(bytes)})`;

// repeats (and slices) text up to targetChars, so every bucket size has real
// syntax to highlight instead of e.g. padding with whitespace
const tileToSize = (text, targetChars) =>
	text.length >= targetChars ? text.slice(0, targetChars) : text.repeat(Math.ceil(targetChars / text.length)).slice(0, targetChars);

export const TRIALS = 9; // odd, so the median is a real sample rather than an average of two
const TRIAL_MS = 400; // per-trial measurement window

/**
 * Each entry lazily loads one library and returns the function under test, so
 * importing this module from the orchestrator pulls in no highlighter at all.
 * `load` is given the corpus files it has to support: the cold-start pass asks
 * for JavaScript alone, the warm pass for everything.
 */
export const LIBRARIES = {
	'speed-highlight': {
		load: async () => {
			const { highlightHTML } = await import('../dist/index.js');
			return file => highlightHTML(file.code, file.shj);
		},
	},
	'prismjs': {
		load: async files => {
			const Prism = require('prismjs');
			for (const { common } of files)
				if (!Prism.languages[common]) require(`prismjs/components/prism-${common}`);
			return file => Prism.highlight(file.code, Prism.languages[file.common], file.common);
		},
	},
	'highlight.js': {
		load: async files => {
			const hljs = (await import('highlight.js/lib/core')).default;
			for (const { common } of files)
				hljs.registerLanguage(common, (await import(`highlight.js/lib/languages/${common}`)).default);
			return file => hljs.highlight(file.code, { language: file.common });
		},
	},
	'shiki (js engine)': {
		load: async files => {
			const { createHighlighter } = await import('shiki');
			const { createJavaScriptRegexEngine } = await import('shiki/engine/javascript');
			const shiki = await createHighlighter({
				themes: ['github-light'],
				langs: files.map(({ common }) => common),
				engine: createJavaScriptRegexEngine(),
			});
			return file => shiki.codeToHtml(file.code, { lang: file.common, theme: 'github-light' });
		},
	},
	'sugar-high': {
		load: async () => {
			const { highlight } = await import('sugar-high');
			// lang() maps our corpus names onto sugar-high's canonical ones,
			// which mostly match apart from bash -> shell
			const { lang } = await import('sugar-high/lang');
			return file => highlight(file.code, { lang: lang(file.common) });
		},
	},
};

const timeMs = async fn => {
	const start = performance.now();
	await fn();
	return performance.now() - start;
};

// ops/min for one file over a single trial window
const bench = async (fn, file, trialMs = TRIAL_MS) => {
	let ops = 0;
	const start = performance.now();
	while (performance.now() - start < trialMs) {
		await fn(file);
		ops++;
	}
	return ops / ((performance.now() - start) / 60000);
};

const median = xs => {
	const sorted = [...xs].sort((a, b) => a - b);
	return sorted[(sorted.length - 1) >> 1];
};

const mean = xs => xs.reduce((total, x) => total + x, 0) / xs.length;

// repeats bench() TRIALS times (sequentially, to avoid contention skewing results) and takes the median ops/min
const benchMedian = async (fn, file, trialMs = TRIAL_MS) => {
	const samples = [];
	for (let t = 0; t < TRIALS; t++) samples.push(await bench(fn, file, trialMs));
	return median(samples);
};

const measure = async name => {
	const { load } = LIBRARIES[name];
	const total = corpus.length * SIZE_BUCKETS.length;
	let done = 0;

	// only ever called between timed cells, so the IPC write can't land inside
	// a measurement window
	const report = cell => process.send({ type: 'progress', done, total, cell });

	report('loading');

	// cold start: import + first highlight of test.js, the very first thing
	// this process does. Inherently a one-shot event, so it isn't size-swept
	// or repeated, and it loads only the one grammar it highlights.
	const cold = await timeMs(async () => {
		const fn = await load([corpus[0]]);
		await fn(corpus[0]);
	});

	const fn = await load(corpus);
	for (const file of corpus) await fn(file); // grammar loading, JIT priming

	// the only timing pass: one median per language per size
	const perLanguage = {};
	for (const file of corpus) {
		perLanguage[file.shj] = {};
		for (const bucket of SIZE_BUCKETS) {
			const sized = { ...file, code: tileToSize(file.code, bucket.bytes) };
			report(`${file.shj}/${bucket.label}`);
			await fn(sized); // warm on this size profile before timing
			perLanguage[file.shj][bucket.label] = Math.round(await benchMedian(fn, sized));
			done++;
		}
	}

	const warm = Object.fromEntries(
		SIZE_BUCKETS.map(({ label }) => [label, Math.round(mean(corpus.map(file => perLanguage[file.shj][label])))]),
	);

	return { type: 'result', cold, warm, perLanguage };
};

// only measures when forked with `--measure <library>`; the orchestrator also
// imports this module for LIBRARIES and the corpus, and must not trigger a run
const [flag, name] = process.argv.slice(2);
if (flag === '--measure') process.send(await measure(name), () => process.exit(0));
