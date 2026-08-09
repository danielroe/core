import { deepStrictEqual } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { tokenize as tokenizeAsync } from '../src/index.js';
import css from '../src/languages/css.js';
import html from '../src/languages/html.js';
import js from '../src/languages/js.js';
import js_template_literals from '../src/languages/js_template_literals.js';
import jsdoc from '../src/languages/jsdoc.js';
import json from '../src/languages/json.js';
import regex from '../src/languages/regex.js';
import todo from '../src/languages/todo.js';
import { tokenizeSync } from '../src/tokenize.js';

let fixtures = new URL('../examples/languages/', import.meta.url),
	languages = { css, html, js, js_template_literals, jsdoc, json, regex, todo },
	read = file => readFileSync(new URL(file, fixtures), 'utf8'),
	collect = (src, lang, opt) => {
		let tokens = [];
		tokenizeSync(src, lang, (str, token) => tokens.push([token, str]), opt);
		return tokens;
	},
	collectAsync = async (src, lang) => {
		let tokens = [];
		await tokenizeAsync(src, lang, (str, token) => tokens.push([token, str]));
		return tokens;
	};

test('a definition given as a sub needs no registry', async () => {
	let src = read('test.json');

	deepStrictEqual(collect(src, { sub: json }), await collectAsync(src, 'json'));
});

test('a language can be given directly as its grammar', async () => {
	let src = read('test.json');

	deepStrictEqual(collect(src, json), await collectAsync(src, 'json'));
	deepStrictEqual(collect(src, json), collect(src, { sub: json }));
});

test('a nested sub is resolved from the given languages', async () => {
	let src = read('test.html');

	deepStrictEqual(collect(src, { sub: html }, { languages }), await collectAsync(src, 'html'));
});

test('a language can be given by name', async () => {
	let src = read('test.js');

	deepStrictEqual(collect(src, 'js', { languages }), await collectAsync(src, 'js'));
});

test('a language can be given bare or wrapped in a sub', async () => {
	let src = read('test.json');

	deepStrictEqual(
		collect(src, 'json', { languages: { json: { sub: json } } }),
		collect(src, 'json', { languages }));
});

test('the type of a language applies to the text it does not match', () => {
	deepStrictEqual(collect('// TODO stuff', { sub: js }, { languages }), [
		[undefined, ''],
		['cmnt', '// '],
		['err', 'TODO'],
		['cmnt', ' stuff'],
		[undefined, '']
	]);
});

test('a sub that is not given is emitted as plain text', () => {
	deepStrictEqual(collect('// TODO stuff', { sub: js }), [
		[undefined, ''],
		[undefined, '// TODO stuff'],
		[undefined, '']
	]);
});

test('a language that is not given is emitted as plain text', () => {
	deepStrictEqual(collect('{}', 'json'), [[undefined, '{}']]);
});
