/**
 * @module index
 * (Base script)
*/

/**
 * Languages bundled by default
 * @typedef {('asm'|'bash'|'bf'|'c'|'css'|'csv'|'diff'|'docker'|'git'|'go'|'html'|'http'|'ini'|'java'|'js'|'jsdoc'|'json'|'leanpub-md'|'log'|'lua'|'make'|'md'|'pl'|'plain'|'py'|'regex'|'rs'|'sql'|'todo'|'toml'|'ts'|'uri'|'xml'|'yaml')} ShjBuiltinLanguage
 */

/**
 * A bundled language or any name the loader can give
 * @typedef {ShjBuiltinLanguage | (string & {})} ShjLanguage
 */

/**
 * @typedef {import('./tokenize.js').ShjToken} ShjToken
 * @typedef {import('./tokenize.js').ShjMatcher} ShjMatcher
 * @typedef {import('./tokenize.js').ShjLanguageData} ShjLanguageData
 * @typedef {import('./tokenize.js').ShjRule} ShjRule
 * @typedef {import('./tokenize.js').ShjGrammar} ShjGrammar
 * @typedef {import('./tokenize.js').ShjTokenCallback} ShjTokenCallback
 */

/**
 * Give a language for the asked name: the language, its module, or a promise of either
 * @typedef {(name: string) => ShjLanguageData | { default: ShjLanguageData } | Promise<ShjLanguageData | { default: ShjLanguageData }> | undefined} ShjLanguageLoader
 */

/**
 * Themes supported in the browser
 * @typedef {('atom-dark'|'github-dark'|'github-dim'|'dark'|'default'|'github-light'|'visual-studio-dark')} ShjBrowserTheme
 */

/**
 * @typedef {Object} ShjOptions
 * @property {boolean} [hideLineNumbers=false] Indicates whether to hide line numbers
 */

/**
 * @typedef {('inline'|'oneline'|'multiline')} ShjDisplayMode
 * * `inline` inside `code` element
 * * `oneline` inside `div` element and containing only one line
 * * `multiline` inside `div` element
 */

import { tokenizer } from './tokenize.js';

/**
 * Loader of the bundled languages, can be called
 * by a custom loader as its fallback
 *
 * @type {ShjLanguageLoader}
 */
export const defaultLoader = name => import(`./languages/${name}.js`);

let loader = defaultLoader;

const cache = /** @type {Object<string, ReturnType<ShjLanguageLoader>>} */ ({}),
	sanitize = (str = '') =>
		str.replaceAll('&', '&#38;').replaceAll?.('<', '&lt;').replaceAll?.('>', '&gt;'),
	/**
	 * Create a HTML element with the right token styling
	 *
	 * @function
	 * @ignore
	 * @param {string} str The content (need to be sanitized)
	 * @param {ShjToken} [token] The type of token
	 * @returns A HTML string
	 */
	toSpan = (str, token) => token ? `<span class="shj-syn-${token}">${str}</span>` : str;

/**
 * Find the tokens in the given code and call the given callback,
 * bundled languages are loaded on first use
 *
 * @function tokenize
 * @param {string} src The code
 * @param {ShjLanguage|ShjLanguageData} lang The language of the code
 * @param {ShjTokenCallback} onToken Called with the text and type of each token
 */
export async function tokenize(src, lang, onToken) {
	let it = tokenizer(src, lang, onToken),
		res = it.next();

	while (!res.done) {
		let name = /** @type {string} */ (res.value),
			data;
		try {
			// the loader is only called on cache misses, import() can throw
			// synchronously when bundled so it cannot be a catch on the promise
			data = /** @type {{ default?: ShjLanguageData, sub?: ShjGrammar }|undefined} */ (await (cache[name] ??= loader(name)));
		}
		catch {}
		res = it.next(/** @type {ShjLanguageData|undefined} */ (data?.default ?? data));
	}
}

/**
 * Highlight a string passed as argument and return it
 * @example
 * elm.innerHTML = await highlightHTML(code, 'js');
 *
 * @async
 * @function highlightHTML
 * @param {string} src The code
 * @param {ShjLanguage|ShjLanguageData} lang The language of the code
 * @param {Boolean} [multiline=true] If it is multiline, it will add a wrapper for the line numbering and header
 * @param {ShjOptions} [opt={}] Customization options
 * @returns {Promise<string>} The highlighted string
 */
export async function highlightHTML(src, lang, multiline = true, opt = {}) {
	let tmp = ''
	await tokenize(src, lang, (str, type) => tmp += toSpan(sanitize(str), type))

	return multiline
		? `<div><div class="shj-numbers">${'<div></div>'.repeat(!opt.hideLineNumbers && src.split('\n').length)}</div><div>${tmp}</div></div>`
		: tmp;
}

/**
 * Highlight a DOM element by getting the new innerHTML with highlightHTML
 *
 * @async
 * @function highlightElement
 * @param {Element} elm The DOM element
 * @param {ShjLanguage} [lang] The language of the code (seaching by default on `elm` for a 'shj-lang-' class)
 * @param {ShjDisplayMode} [mode] The display mode (guessed by default)
 * @param {ShjOptions} [opt={}] Customization options
 */
export async function highlightElement(elm, lang = /** @type {ShjLanguage} */ (elm.className.match(/shj-lang-([\w-]+)/)?.[1]), mode, opt) {
	let txt = elm.textContent;
	mode ??= `${elm.tagName == 'CODE' ? 'in' : (txt.split('\n').length < 2 ? 'one' : 'multi')}line`;
	/** @type {HTMLElement} */ (elm).dataset.lang = lang;
	elm.className = `${[...elm.classList].filter(className => !className.startsWith('shj-')).join(' ')} shj-lang-${lang} shj-${mode}`;
	elm.innerHTML = await highlightHTML(txt, lang, mode == 'multiline', opt);
}

/**
 * Call highlightElement on element with a css class starting with `shj-lang-`
 *
 * @async
 * @function highlightAll
 * @param {ShjOptions} [opt={}] Customization options
 */
export let highlightAll = async (opt) =>
	Promise.all(
		Array.from(document.querySelectorAll('[class*="shj-lang-"]'))
		.map(elm => highlightElement(elm, undefined, undefined, opt)))

/**
 * A theme, mapping each token type to the ANSI escape printed before it
 * @typedef {Partial<Record<ShjToken, string>>} ShjTerminalTheme
 */

/**
 * Highlight a string passed as argument and return a string that can directly
 * be printed in a terminal, bundled languages are loaded on first use
 *
 * @async
 * @function highlightANSI
 * @param {string} src The code
 * @param {ShjLanguage|ShjLanguageData} lang The language of the code
 * @param {ShjTerminalTheme} theme The theme to use, e.g. imported from `themes/atom-dark.js`
 * @returns {Promise<string>} The highlighted string
 */
export const highlightANSI = async (src, lang, theme) => {
	let res = '';

	await tokenize(src, lang, (str, token) => res += token ? `${theme[token] ?? ''}${str}\x1b[0m` : str);

	return res;
};

/**
 * Replace how language names are loaded, call it before highlighting
 *
 * @example
 * setLoader(name => customs[name] ?? defaultLoader(name));
 *
 * @function setLoader
 * @param {ShjLanguageLoader} newLoader Given a name, returns the language, its module, or a promise of either
 */
export let setLoader = newLoader => {
	loader = newLoader;
}
