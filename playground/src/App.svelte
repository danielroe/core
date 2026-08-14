<script>
	import { highlightANSI } from '@speed-highlight/core';
	import { detectLanguage } from '@speed-highlight/core/detect';
	import Chip from './lib/Chip.svelte';
	import Copy from './lib/Copy.svelte';
	import Editor from './lib/Editor.svelte';
	import Toggle from './lib/Toggle.svelte';

	// bundled at build time so the playground works without runtime paths;
	// themes come from dist where the @import on default.css is already
	// resolved, the raw src files would lose the base rules when injected
	const themeCss = import.meta.glob('../../dist/themes/*.css', { query: '?raw', import: 'default', eager: true });
	const samples = import.meta.glob('../../examples/languages/test.*', { query: '?raw', import: 'default' });

	// every language with a sample file, nothing to keep in sync by hand
	const languages = Object.keys(samples).map(path => path.split('/test.').pop());

	// language icons from bearded-icons (see the footer credit): a direct
	// name match wins, then the alias map, then the generic file icon
	const iconUrls = import.meta.glob('./icons/*.svg', { query: '?url', import: 'default', eager: true });
	const iconAliases = {
		ts: 'typescript', py: 'python', rs: 'rust', pl: 'perl', bash: 'shell', make: 'makefile',
		md: 'markdown', 'leanpub-md': 'markdown', ini: 'conf', asm: 'binary', plain: 'txt', jsdoc: 'mkdocs',
	};
	const langIcons = Object.fromEntries(languages.map(name => [
		name,
		iconUrls[`./icons/${name}.svg`] ?? iconUrls[`./icons/${iconAliases[name]}.svg`] ?? iconUrls['./icons/file.svg'],
	]));
	// every theme with a stylesheet; the ones that also ship a js token map
	// work in the terminal, nothing to keep in sync by hand
	const themeOrder = (a, b) => (b === 'default') - (a === 'default') || a.localeCompare(b);
	const allThemes = Object.keys(themeCss)
		.map(path => path.split('/').pop().replace('.css', ''))
		.sort(themeOrder);
	const termThemeModules = import.meta.glob('../../src/themes/*.js', { import: 'default' });
	const terminalThemes = Object.keys(termThemeModules)
		.map(path => path.split('/').pop().replace('.js', ''))
		.filter(name => name !== 'termcolor')
		.sort(themeOrder);

	// each theme's real colors, parsed out of its bundled css, paint the
	// little fake code block previews in the picker
	const themePreviews = Object.fromEntries(Object.entries(themeCss).map(([path, css]) => {
		const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)];
		// the bundled css inlines default.css first, so the theme's own
		// override is the last matching plain rule, like the cascade
		// resolves it; pseudo and descendant rules (::selection, the http
		// header) are not the token's base color
		const colorOf = (selector, property = 'color') => rules
			.findLast(([, sel, body]) =>
				sel.includes(selector) && body.includes(`${property}:`) && !sel.includes(':') && !sel.trim().includes(' '))?.[2]
			.match(new RegExp(`${property}:([^;]+)`))[1];
		return [path.split('/').pop().replace('.css', ''), {
			bg: colorOf('[class*=shj-lang-]', 'background'),
			text: colorOf('[class*=shj-lang-]'),
			kwd: colorOf('.shj-syn-kwd'),
			str: colorOf('.shj-syn-str'),
			cmnt: colorOf('.shj-syn-cmnt'),
			num: colorOf('.shj-syn-num'),
			func: colorOf('.shj-syn-func'),
		}];
	}));
	// light/dark grouping derived from each theme's background luminance
	const luma = color => {
		const hex = color?.trim().match(/^#([0-9a-f]{3,8})$/i)?.[1];
		if (!hex)
			return 0;
		const full = hex.length < 6 ? [...hex].map(c => c + c).join('') : hex;
		const [r, g, b] = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16) / 255);
		return 0.2126 * r + 0.7152 * g + 0.0722 * b;
	};
	const themeGroups = {
		light: allThemes.filter(name => luma(themePreviews[name].bg) > 0.5),
		dark: allThemes.filter(name => luma(themePreviews[name].bg) <= 0.5),
	};
	const orderedThemes = [...themeGroups.light, ...themeGroups.dark];

	const ansiPalette = { 30: '#3f4451', 31: '#e06c75', 32: '#98c379', 33: '#e5c07b', 34: '#61afef', 35: '#c678dd', 36: '#56b6c2', 37: '#e8e8ee', 90: '#7f8494' };

	const initial = new URLSearchParams(location.hash.slice(1));

	// device preference by default, the user's choice is remembered
	const storedDark = localStorage.getItem('shj-dark');
	const initialDark = storedDark !== null ? storedDark === '1' : matchMedia('(prefers-color-scheme: dark)').matches;

	let lang = $state(languages.includes(initial.get('lang')) ? initial.get('lang') : 'js');
	let dark = $state(initialDark);
	let theme = $state(allThemes.includes(initial.get('theme')) ? initial.get('theme') : (initialDark ? 'atom-dark' : 'default'));
	let previewTheme = $state(null);
	let terminalTheme = $state(terminalThemes.includes(initial.get('termTheme')) ? initial.get('termTheme') : 'default');
	let previewTermTheme = $state(null);
	let detect = $state(initial.has('detect'));
	let numbers = $state(true);
	let code = $state(initial.get('code') ?? '');
	let ms = $state(null);
	let ansiMs = $state(null);
	let terminalHtml = $state('');

	const fmtMs = value => value === null ? '' : `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ms`;

	// the import variable for a theme: atom-dark reads as atomDark, and
	// default cannot shadow the keyword
	const themeVar = name => name === 'default' ? 'defaultTheme' : name.replace(/-(\w)/g, (_, c) => c.toUpperCase());

	const activeLang = $derived(detect ? detectLanguage(code) : lang);
	const themeStyle = $derived(themeCss[`../../dist/themes/${previewTheme ?? theme}.css`]);
	const termTheme = $derived(previewTermTheme ?? terminalTheme);
	const activePreview = $derived(themePreviews[previewTheme ?? theme]);

	// what the whole-header copy buttons put in the clipboard, runnable as is
	const editorSnippet = $derived(`import { highlightHTML } from '@speed-highlight/core';\nimport '@speed-highlight/core/themes/${previewTheme ?? theme}.css';\n\nelement.className = 'shj-lang-${activeLang} shj-block';\nelement.innerHTML = await highlightHTML(code, '${activeLang}', { showLineNumbers: ${numbers} });`);
	const terminalSnippet = $derived(`import { highlightANSI } from '@speed-highlight/core';\nimport ${themeVar(previewTermTheme ?? terminalTheme)} from '@speed-highlight/core/themes/${previewTermTheme ?? terminalTheme}.js';\n\nconsole.log(await highlightANSI(code, '${activeLang}', ${themeVar(previewTermTheme ?? terminalTheme)}));`);

	async function loadSample(name) {
		code = await samples[`../../examples/languages/test.${name}`]();
	}

	if (!initial.has('code'))
		loadSample(languages.includes(initial.get('lang')) ? initial.get('lang') : 'js');

	function pickLanguage(name) {
		lang = name;
		loadSample(name);
	}

	// the active code theme is global css, swapped by rewriting one style tag
	const themeStyleElement = document.createElement('style');
	document.head.append(themeStyleElement);
	$effect(() => {
		themeStyleElement.textContent = themeStyle;
	});

	// only the page mode is a device preference, the highlighting themes
	// travel in the url so a shared link looks the same for everyone
	$effect(() => {
		document.documentElement.classList.toggle('dark', dark);
		localStorage.setItem('shj-dark', dark ? '1' : '0');
	});

	function toggleDark() {
		dark = !dark;
		// switch the code theme in tandem unless it already matches the mode
		if (!themeGroups[dark ? 'dark' : 'light'].includes(theme))
			theme = dark ? 'atom-dark' : 'default';
	}

	const escapeHtml = str => str.replaceAll('&', '&#38;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
	const ansiToHtml = ansi => escapeHtml(ansi).replace(/\x1b\[(\d+)m([^\x1b]*)/g, (_, colorCode, text) =>
		ansiPalette[colorCode] ? `<span style="color:${ansiPalette[colorCode]}">${text}</span>` : text);

	// the editor paints immediately, the secondary panels and the shareable
	// url follow debounced
	$effect(() => {
		// the render follows the hover preview, the url only keeps picks
		const [source, language, renderTheme, pickedTermTheme, pickedTheme] = [code, activeLang, termTheme, terminalTheme, theme];
		const timer = setTimeout(async () => {
			const themeMap = await termThemeModules[`../../src/themes/${renderTheme}.js`]();
			const start = performance.now();
			const ansi = await highlightANSI(source, language, themeMap);
			ansiMs = performance.now() - start;
			terminalHtml = ansiToHtml(ansi);

			const params = new URLSearchParams({ lang, theme: pickedTheme, termTheme: pickedTermTheme, ...(detect && { detect: 1 }) });
			if (source.length < 4000)
				params.set('code', source);
			history.replaceState(null, '', `#${params}`);
		}, 120);
		return () => clearTimeout(timer);
	});
</script>

<div class="flex h-screen flex-col">
<header class="h-16 shrink-0 border-b border-line bg-card">
	<div class="mx-auto flex h-full w-full max-w-[1060px] items-center gap-2.5 px-5">
		<h1 class="text-[19px] font-bold tracking-tight text-ink">speed-highlight</h1>
		<nav class="ml-auto flex gap-1">
			<a class="flex size-8.5 items-center justify-center rounded-lg text-ink hover:bg-line/40 focus-visible:outline-2 focus-visible:outline-ink" href="https://www.npmjs.com/package/@speed-highlight/core" target="_blank" rel="noopener" aria-label="npm package" title="npm">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M1.763 0C.786 0 0 .786 0 1.763v20.474C0 23.214.786 24 1.763 24h20.474c.977 0 1.763-.786 1.763-1.763V1.763C24 .786 23.214 0 22.237 0zM5.13 5.323l13.837.019-.009 13.836h-3.464l.01-10.382h-3.456L12.04 19.17H5.113z"/></svg>
			</a>
			<a class="flex size-8.5 items-center justify-center rounded-lg text-ink hover:bg-line/40 focus-visible:outline-2 focus-visible:outline-ink" href="https://github.com/speed-highlight/core" target="_blank" rel="noopener" aria-label="GitHub repository" title="GitHub">
				<svg width="17" height="17" viewBox="0 0 98 96" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z"/></svg>
			</a>
			<button class="flex size-8.5 cursor-pointer items-center justify-center rounded-lg text-ink hover:bg-line/40 focus-visible:outline-2 focus-visible:outline-ink" onclick={toggleDark} aria-label="Toggle light or dark mode" title="Toggle theme">
				{#if dark}
					<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 3a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1zm0-19a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V2a1 1 0 0 1 1-1zm11 11a1 1 0 0 1-1 1h-1a1 1 0 1 1 0-2h1a1 1 0 0 1 1 1zM4 12a1 1 0 0 1-1 1H2a1 1 0 1 1 0-2h1a1 1 0 0 1 1 1zm15.07 7.07a1 1 0 0 1-1.41 0l-.71-.71a1 1 0 0 1 1.41-1.41l.71.71a1 1 0 0 1 0 1.41zM7.05 7.05a1 1 0 0 1-1.41 0l-.71-.71A1 1 0 0 1 6.34 4.93l.71.71a1 1 0 0 1 0 1.41zm12.02-2.12a1 1 0 0 1 0 1.41l-.71.71a1 1 0 1 1-1.41-1.41l.71-.71a1 1 0 0 1 1.41 0zM7.05 16.95a1 1 0 0 1 0 1.41l-.71.71a1 1 0 0 1-1.41-1.41l.71-.71a1 1 0 0 1 1.41 0z"/></svg>
				{:else}
					<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
				{/if}
			</button>
		</nav>
	</div>
</header>

<div class="min-h-0 flex-1 overflow-y-auto">
<div class="mx-auto flex w-full max-w-[1060px] items-start px-5 max-sm:flex-col max-sm:px-0">
	<aside class="lang-list sticky top-0 h-[calc(100dvh-4rem)] w-44 shrink-0 overflow-y-auto overscroll-contain border-r border-line pr-1.5 pb-1.5 max-sm:static max-sm:flex max-sm:h-auto max-sm:w-full max-sm:gap-1 max-sm:overflow-x-auto max-sm:border-r-0 max-sm:border-b max-sm:p-1.5" aria-label="Language" role="group">
		<div class="sticky top-0 z-1 bg-page pt-1.5 pb-1 max-sm:static max-sm:shrink-0">
			<div class="overflow-hidden rounded-md border border-line bg-card">
				<div class="px-2 py-2">
					<Toggle bind:checked={detect} label="detect" />
				</div>
				{#if detect}
					<div class="flex min-w-0 items-center gap-1.5 border-t border-line bg-page/50 px-2 py-1.5 font-mono text-[11px] text-ink">
						<img class="size-3.5 shrink-0" src={langIcons[activeLang] ?? langIcons.plain} alt="">
						<span class="truncate">{activeLang}</span>
					</div>
				{/if}
			</div>
		</div>
		{#each languages as name (name)}
			<button
				type="button"
				aria-pressed={name === lang && !detect}
				class="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] text-ink-dim hover:bg-card aria-pressed:bg-card aria-pressed:text-ink-strong max-sm:w-auto"
				onclick={() => pickLanguage(name)}
			>
				<img class="size-4 shrink-0" src={langIcons[name]} alt="">{name}
			</button>
		{/each}
	</aside>

	<main class="min-w-0 flex-1">
	<div class="mx-auto max-w-[900px] px-6 pt-4 pb-10">
	{#snippet themeRadio(names, selected, pick, hover)}
		<div class="flex flex-wrap items-start gap-2 pb-3" role="group" aria-label="Theme"
			onmouseleave={() => hover(null)}>
			{#each names as name (name)}
				{@const preview = themePreviews[name]}
				<button
					type="button"
					aria-pressed={name === selected}
					class="group flex cursor-pointer flex-col items-center gap-1"
					onclick={() => pick(name)}
					onmouseenter={() => hover(name)}
				>
					<span
						class="flex h-11 w-19 flex-col justify-center gap-[5px] rounded-md border border-line px-2 group-aria-pressed:outline-2 group-aria-pressed:outline-offset-1 group-aria-pressed:outline-accent"
						style="background: {preview.bg}"
					>
						<span class="flex gap-1">
							<i class="h-1 w-1/4 rounded-full" style="background: {preview.kwd}"></i>
							<i class="h-1 w-2/5 rounded-full" style="background: {preview.func}"></i>
						</span>
						<span class="flex gap-1">
							<i class="h-1 w-1/5 rounded-full" style="background: {preview.num}"></i>
							<i class="h-1 w-1/2 rounded-full" style="background: {preview.str}"></i>
						</span>
						<span class="flex gap-1">
							<i class="h-1 w-2/5 rounded-full" style="background: {preview.cmnt}"></i>
						</span>
					</span>
					<span class="max-w-19 truncate text-[11px] text-ink-dim group-aria-pressed:text-ink-strong">{name.replace('visual-studio', 'vs')}</span>
				</button>
			{/each}
		</div>
	{/snippet}

	{@render themeRadio(orderedThemes, theme,
		name => { theme = name; previewTheme = null; },
		name => previewTheme = name)}

	{#snippet langChip()}
		<Chip copy={activeLang} icon={langIcons[activeLang] ?? langIcons.plain}>'{activeLang}'</Chip>
	{/snippet}

	<div class="mb-1.5 flex flex-col gap-0.5 rounded-md border border-line bg-card px-2.5 py-1.5 font-mono text-[11.5px] leading-5 text-ink-dim">
		<div class="flex items-center">
			<span class="min-w-0 flex-1 overflow-x-auto whitespace-nowrap">import &#123; <span class="text-ink">highlightHTML</span> &#125; from '@speed-highlight/core';</span>
			<span class="shrink-0 pl-3"><Copy text={editorSnippet} /></span>
		</div>
		<div class="flex items-center overflow-x-auto whitespace-nowrap">
			<span>import</span>
			<Chip copy={`@speed-highlight/core/themes/${previewTheme ?? theme}.css`}>'@speed-highlight/core/themes/{previewTheme ?? theme}.css'</Chip>
			<span>;</span>
		</div>
		<div class="flex items-center">
			<span class="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto whitespace-nowrap">
				<span class="text-ink">highlightHTML</span><span>(code,</span>
				{@render langChip()}
				<span>, &#123; showLineNumbers:</span>
				<span class="mx-1"><Toggle bind:checked={numbers} /></span>
				<span>&#125;)</span>
			</span>
			<span class="w-16 shrink-0 pl-3 text-right tabular-nums">{fmtMs(ms)}</span>
		</div>
	</div>
	<Editor bind:code lang={activeLang} {numbers}
		caret={activePreview.text}
		darkTooltip={luma(activePreview.bg) <= 0.5}
		onms={value => ms = value} />

	<div class="mt-12"></div>
	{@render themeRadio(terminalThemes, terminalTheme,
		name => { terminalTheme = name; previewTermTheme = null; },
		name => previewTermTheme = name)}
	<div class="mb-1.5 flex flex-col gap-0.5 rounded-md border border-line bg-card px-2.5 py-1.5 font-mono text-[11.5px] leading-5 text-ink-dim">
		<div class="flex items-center">
			<span class="min-w-0 flex-1 overflow-x-auto whitespace-nowrap">import &#123; <span class="text-ink">highlightANSI</span> &#125; from '@speed-highlight/core';</span>
			<span class="shrink-0 pl-3"><Copy text={terminalSnippet} /></span>
		</div>
		<div class="flex items-center overflow-x-auto whitespace-nowrap">
			<span>import</span>
			<Chip copy={themeVar(termTheme)}>{themeVar(termTheme)}</Chip>
			<span>from</span>
			<Chip copy={`@speed-highlight/core/themes/${termTheme}.js`}>'@speed-highlight/core/themes/{termTheme}.js'</Chip>
			<span>;</span>
		</div>
		<div class="flex items-center">
			<span class="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto whitespace-nowrap">
				<span class="text-ink">highlightANSI</span><span>(code,</span>
				{@render langChip()}
				<span>,</span>
				<Chip copy={themeVar(termTheme)}>{themeVar(termTheme)}</Chip>
				<span>)</span>
			</span>
			<span class="w-16 shrink-0 pl-3 text-right tabular-nums">{fmtMs(ansiMs)}</span>
		</div>
	</div>
	<!-- a terminal always looks dark, regardless of the page mode, so the
	     dark tokens are forced locally instead of hardcoding new colors -->
	<div class="dark overflow-x-auto rounded-xl bg-page p-4 font-mono text-[13.5px]/[23px] whitespace-pre text-ink-strong">{@html terminalHtml}</div>

	<footer class="pt-8 text-[12.5px] text-ink-dim">
		Language icons from <a class="underline hover:text-ink" href="https://github.com/BeardedBear/bearded-icons" target="_blank" rel="noopener">Bearded Icons</a>.
	</footer>
	</div>
	</main>
</div>
</div>
</div>
