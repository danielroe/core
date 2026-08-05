/**
 * @module terminal
 * (Terminal adaptor)
*/

/**
 * @typedef {import('./index.js').ShjLanguage} ShjLanguage
 */

/**
 * A theme, mapping each token type to the ANSI escape printed before it
 * @typedef {Partial<Record<import('./index.js').ShjToken, string>>} ShjTerminalTheme
 */

import { tokenize } from './index.js';
import defaultTheme from './themes/default.js';

/**
 * Highlight a string passed as argument and return a string that can directly be printed
 *
 * @async
 * @function highlightText
 * @param {string} src The code
 * @param {ShjLanguage} lang The language of the code
 * @param {ShjTerminalTheme} [theme] The theme to use, e.g. imported from `themes/atom-dark.js`
 * @returns {Promise<string>} The highlighted string
 */
export const highlightText = async (src, lang, theme = defaultTheme) => {
	let res = '';

	await tokenize(src, lang, (str, token) => res += token ? `${theme[token] ?? ''}${str}\x1b[0m` : str);

	return res;
};

/**
 * Highlight and print a given string
 *
 * @async
 * @function printHighlight
 * @param {string} src The code
 * @param {ShjLanguage} lang The language of the code
 * @param {ShjTerminalTheme} [theme] The theme to use, e.g. imported from `themes/atom-dark.js`
 */
export const printHighlight = async (src, lang, theme) => console.log(await highlightText(src, lang, theme));
