/**
 * Reproducible speed comparison against other highlighters. Run with
 * `npm run benchmark`; add `-- --write` to update the README's Benchmark
 * section. Deliberately not part of `npm run build`: a shared CI runner is
 * the worst machine to publish a comparison from, so the README's numbers
 * are refreshed by hand from a quiet one (named in the output header).
 *
 * This file only orchestrates and formats. Every library is measured by
 * scripts/benchmark-runner.js in a process of its own, which is where the
 * corpus, the library adapters and the timing methodology live.
 *
 * Running each library in a fresh process means its cold start is genuinely
 * cold (no other highlighter has been imported yet) and its warm figures
 * aren't affected by the heap and JIT state of the libraries benched before
 * it.
 *
 * Those processes run one at a time whenever the numbers are going to be
 * published (`--write`, or an explicit `--sequential`). Otherwise they all
 * run at once, which is roughly 40% faster and fine for spotting a
 * regression while iterating, but not fine for a published comparison: a
 * machine with both performance and efficiency cores (this one has 4 and 6)
 * can't give every process equal CPU, and which library ends up on a slow
 * core is the scheduler's choice, not a property of the library. Concurrent
 * runs say so above the table.
 */

import { fork } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { LIBRARIES, SIZE_BUCKETS, TRIALS, bucketLabel, corpus } from './benchmark-runner.js';
import { readReadme, replaceMarkedSection, writeReadme } from './readme.js';

const runnerPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'benchmark-runner.js');
const names = Object.keys(LIBRARIES);

const writing = process.argv.includes('--write');
const concurrent = !writing && !process.argv.includes('--sequential');
// live redraws need a terminal; CI gets plain lines, and --quiet gets nothing
const progressMode = process.argv.includes('--quiet') ? 'off' : process.stderr.isTTY && !process.env.CI ? 'live' : 'plain';

// ---- formatting

const fmtMs = ms => `${ms >= 10 ? ms.toFixed(0) : ms.toFixed(1)} ms`;
const fmtOps = ops => `${ops.toLocaleString('en-US')} ops/min`;

const fmtDuration = ms => {
	const seconds = Math.round(ms / 1000);
	return seconds >= 60 ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : `${seconds}s`;
};

const NAME_WIDTH = 22;
const COL_WIDTH = 19; // fits ops/min figures up to 9,999,999 without breaking column alignment
const BAR_WIDTH = 20;

// ---- progress
//
// One entry per library, written only by runLibrary as its process reports
// in. The live block and the closing time report are two views of these rows.

const state = new Map(names.map(name => [name, { started: false, finished: false, done: 0, total: 0, cell: '', startedAt: 0, elapsedMs: 0 }]));

const bar = (done, total) => {
	const filled = total ? Math.round((done / total) * BAR_WIDTH) : 0;
	return `[${'#'.repeat(filled)}${'.'.repeat(BAR_WIDTH - filled)}]`;
};

const progressRow = name => {
	const entry = state.get(name);
	const running = entry.started && !entry.finished;
	const elapsed = entry.finished ? entry.elapsedMs : running ? performance.now() - entry.startedAt : 0;
	return (
		name.padEnd(NAME_WIDTH) +
		(entry.finished ? 'done' : entry.started ? bar(entry.done, entry.total) : 'waiting').padEnd(BAR_WIDTH + 3) +
		(running ? `${entry.done}/${entry.total}` : '').padStart(6) +
		`  ${(running ? entry.cell : '').padEnd(14)}` +
		(entry.started ? fmtDuration(elapsed).padStart(6) : '')
	);
};

// every escape sequence lives here, so nothing else has to know how many
// lines are currently on screen
const liveBlock = {
	drawn: 0,
	redraw() {
		process.stderr.write(
			(this.drawn ? `\x1b[${this.drawn}A` : '') + names.map(name => `\x1b[2K${progressRow(name)}\n`).join(''));
		this.drawn = names.length;
	},
	// the block turns into the final report rather than printing the same
	// rows twice
	replaceWith(text) {
		process.stderr.write((this.drawn ? `\x1b[${this.drawn}A\x1b[0J` : '\n') + text);
		this.drawn = 0;
	}
};

const printTimeReport = wallMs => {
	if (progressMode === 'off')
		return;
	const processMs = names.reduce((total, name) => total + state.get(name).elapsedMs, 0);
	const header = concurrent
		? `time spent (concurrent, ${fmtDuration(wallMs)} wall, ${fmtDuration(processMs)} process):`
		: `time spent (sequential, ${fmtDuration(wallMs)} wall):`;
	const rows = [...names]
		.sort((a, b) => state.get(b).elapsedMs - state.get(a).elapsedMs)
		.map(name => `${progressRow(name)}  ${`${Math.round((state.get(name).elapsedMs / processMs) * 100)}%`.padStart(4)}`);
	liveBlock.replaceWith(`${header}\n${rows.join('\n')}\n\n`);
};

// ---- running

const running = new Set();

const runLibrary = name =>
	new Promise((resolve, reject) => {
		const entry = state.get(name);
		entry.started = true;
		entry.startedAt = performance.now();
		if (progressMode === 'plain')
			process.stderr.write(`benchmarking ${name}...\n`);

		// piped rather than inherited: a child writing to the terminal would
		// corrupt the redrawn progress block, and buffering means its output is
		// still there to show if it fails
		const child = fork(runnerPath, ['--measure', name], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
		running.add(child);

		let logged = '';
		child.stdout.on('data', chunk => (logged += chunk));
		child.stderr.on('data', chunk => (logged += chunk));

		let result;
		child.on('message', message => {
			if (message.type === 'progress')
				Object.assign(entry, { done: message.done, total: message.total, cell: message.cell });
			else
				result = message;
		});
		child.on('error', reject);
		child.on('exit', code => {
			running.delete(child);
			entry.elapsedMs = performance.now() - entry.startedAt;
			entry.finished = true;
			if (progressMode === 'plain')
				process.stderr.write(`${name} done in ${fmtDuration(entry.elapsedMs)}\n`);
			if (code === 0 && result)
				return resolve(result);
			if (logged)
				process.stderr.write(logged);
			reject(new Error(`benchmark runner for ${name} exited with code ${code}`));
		});
	});

const ticker = progressMode === 'live' ? setInterval(() => liveBlock.redraw(), 250) : undefined;
ticker?.unref();
if (progressMode === 'live')
	liveBlock.redraw();

const results = {};
const startedAt = performance.now();

try {
	if (concurrent) {
		const measured = await Promise.all(names.map(runLibrary));
		names.forEach((name, i) => (results[name] = measured[i]));
	} else {
		for (const name of names) results[name] = await runLibrary(name);
	}
} catch (error) {
	// Promise.all rejecting leaves the other forks running, and an orphaned
	// prismjs run burns a core for minutes
	for (const child of running) child.kill();
	clearInterval(ticker);
	throw error;
}

clearInterval(ticker);
printTimeReport(performance.now() - startedAt);

// ---- report
//
// These lines are the README's Benchmark block, so they are collected as text
// and printed in one go; anything that is commentary goes to stderr instead.

const report = [];
const line = text => report.push(text);

const rowCold = (name, ms) => line(`${name.padEnd(NAME_WIDTH)}${fmtMs(ms).padStart(COL_WIDTH)}`);
const rowHeader = (label, cols) => line(`${label.padEnd(NAME_WIDTH)}${cols.map(c => c.padStart(COL_WIDTH)).join('')}`);
const rowData = (name, values) => line(`${name.padEnd(NAME_WIDTH)}${values.map(v => fmtOps(v).padStart(COL_WIDTH)).join('')}`);

const bucketValues = byBucket => SIZE_BUCKETS.map(bucket => byBucket[bucket.label]);

line(`node ${process.version}, ${os.platform()} ${os.arch()}${os.cpus()[0] ? `, ${os.cpus()[0].model}` : ''}`);
line(
	`corpus: ${corpus.map(({ shj }) => shj).join(', ')}, tiled to ${SIZE_BUCKETS.length} sizes (${SIZE_BUCKETS.map(bucketLabel).join(' / ')}), median of ${TRIALS} trials per language, averaged across the corpus\n`,
);

const orderedNames = Object.keys(results).sort(
	(a, b) => results[b].warm[SIZE_BUCKETS[0].label] - results[a].warm[SIZE_BUCKETS[0].label],
);

rowHeader('', SIZE_BUCKETS.map(bucketLabel));
for (const name of orderedNames) rowData(name, bucketValues(results[name].warm));

line(`\ncold start (import + first highlight of test.js):`);
for (const name of orderedNames) rowCold(name, results[name].cold);

line(`\nspeed-highlight per language (warm, median of ${TRIALS} trials):`);
rowHeader('', SIZE_BUCKETS.map(bucketLabel));
for (const [language, byBucket] of Object.entries(results['speed-highlight'].perLanguage))
	rowData(language, bucketValues(byBucket));

if (concurrent)
	process.stderr.write('WARNING: concurrent run, figures are indicative only and not comparable between libraries\n\n');

console.log(report.join('\n'));

if (writing) {
	// unreachable rather than a policy: --write forces a sequential run
	if (concurrent)
		throw new Error('refusing to write concurrent results to README.md');
	const block = '```rb\n$ npm run benchmark\n' + report.join('\n') + '\n```';
	writeReadme(replaceMarkedSection(readReadme(), 'BENCHMARK', block));
	console.log('\nREADME.md benchmark section updated');
}
