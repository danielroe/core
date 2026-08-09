/**
 * @module terminal
 * (Terminal adaptor)
*/

/**
 * @typedef {import('./index.js').ShjLanguage} ShjLanguage
 * @typedef {import('./index.js').ShjLanguageData} ShjLanguageData
 */

/**
 * A theme, mapping each token type to the ANSI escape printed before it
 * @typedef {Partial<Record<import('./index.js').ShjToken, string>>} ShjTerminalTheme
 */

import { tokenize } from './index.js';
import defaultTheme from './themes/default.js';

/**
 * Highlight a string passed as argument and return a string that can directly be printed,
 * bundled languages are loaded on first use
 *
 * @async
 * @function highlightText
 * @param {string} src The code
 * @param {ShjLanguage|ShjLanguageData} lang The language of the code
 * @param {ShjTerminalTheme} [theme] The theme to use, e.g. imported from `themes/atom-dark.js`
 * @returns {Promise<string>} The highlighted string
 */
export const highlightText = async (src, lang, theme = defaultTheme) => {
	let res = '';

	await tokenize(src, lang, (str, token) => res += token ? `${theme[token] ?? ''}${str}\x1b[0m` : str);

	return res;
};
