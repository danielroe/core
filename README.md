# speed-highlight

[![NPM Version](https://badge.fury.io/js/@speed-highlight%2Fcore.svg)](https://www.npmjs.com/package/@speed-highlight/core) [![NPM Downloads](https://img.shields.io/npm/dm/%40speed-highlight%2Fcore)](https://www.npmjs.com/package/@speed-highlight/core)

A JavaScript syntax highlighter for the web and the terminal

- **Tiny** <small>(~2kB core, ~1kB per language)</small>
- **Fast** <small>(outperforms Prism and highlight.js)</small>
- **Simple** <small>(zero dependencies)</small>

<p>
	<a href="https://speed-highlight.github.io/core/examples">Demo</a> |
	<a href="https://github.com/speed-highlight/core/wiki">Wiki</a> |
	<a href="https://speed-highlight.github.io/core/docs">Docs</a>
</p>

![Screenshot](https://raw.githubusercontent.com/speed-highlight/core/main/assets/screenshot.png)

## Simple setup 🚀

### Web

Style/theme (in the header of your html file):

```html
<link rel="stylesheet" href="/path/dist/themes/default.css">
```

In the body of your html file:

```html
<div class='shj-lang-[code-language]'>[code]</div>
or
<code class='shj-lang-[code-language]'>[inline code]</code>
```

Highlight the code (in your javascript):

```js
import { highlightAll } from '/path/dist/index.js';
highlightAll();
```

Every bundled language is loaded on first use. Control how names are loaded
by setting your own loader (before highlighting), the default one is given
to be composed with:

```js
import { setLoader, defaultLoader } from '@speed-highlight/core';

// add custom languages on top of the bundled ones
setLoader(name => customs[name] ?? defaultLoader(name));

// or only allow the ones your bundler can code-split
setLoader(name => ({
	js: () => import('@speed-highlight/core/languages/js.js'),
	css: () => import('@speed-highlight/core/languages/css.js'),
})[name]?.());
```

> [!NOTE]
> Bundling your app? The name-based functions above reach the whole language
> registry. Use the synchronous API below to only pay for what you import.

Auto language detection

```js
import { highlightElement } from '../dist/index.js';
import { detectLanguage } from '../dist/detect.js';

elm.textContent = code;
highlightElement(elm, detectLanguage(code));
```

Tokenize synchronously, without any registry: every language is given by the
caller, so a bundler only keeps the ones you import

```js
import { tokenizeSync } from '@speed-highlight/core/tokenize';
import { html, css, js } from '@speed-highlight/core/languages';

tokenizeSync(code, html, (str, type) => { /* ... */ }, { languages: { css, js } });
```

A language is either a definition array or `{ type, sub }`; a `sub` referring
to a language not given in `languages` is emitted as plain text.

---

#### CDN

```html
<link rel="stylesheet" href="https://unpkg.com/@speed-highlight/core/dist/themes/default.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/speed-highlight/core/dist/themes/default.css">
```

```js
import ... from 'https://unpkg.com/@speed-highlight/core/dist/index.js';
import ... from 'https://cdn.jsdelivr.net/gh/speed-highlight/core/dist/index.js';
```

---

### Deno

Use the [deno module](https://deno.land/x/speed_highlight_js)

```js
import { highlightANSI } from 'https://deno.land/x/speed_highlight_js/dist/terminal.js';
import theme from 'https://deno.land/x/speed_highlight_js/dist/themes/atom-dark.js';

console.log(await highlightANSI('console.log("hello")', 'js', theme));
```

The theme argument is optional and defaults to the `default` theme.

---

### Node

Use the [npm package](https://www.npmjs.com/package/@speed-highlight/core)

```bash
npm i @speed-highlight/core
```

```js
const { highlightANSI } = require('@speed-highlight/core/terminal');

console.log(await highlightANSI('console.log("hello")', 'js'));
```

Pass a theme imported from `@speed-highlight/core/themes/[theme-name].js` as third argument to use another theme than the default one.

## Migrating from prism

speed-highlight is a lighter and faster version of prism that share a similar API

### Style

Remove the prism stylesheet in the head of your html file
Clone this repository or use a cdn to load our stylesheet

```diff
<head>
-  <link href="themes/prism.css" rel="stylesheet" />
+  <link rel="stylesheet" href="https://unpkg.com/@speed-highlight/core/dist/themes/default.css">
</head>
```

### Script

For the script part remove the prism.js script and replace it by a import and a call to `highlightAll`

```diff
<body>
-  <script src="prism.js"></script>
+<script type="module">
+  import { highlightAll } from 'https://unpkg.com/@speed-highlight/core/dist/index.js';
+  highlightAll();
+</script>
</body>
```

If you want to highlight only a specific element you can use the `highlightElement` function instead

### Code block

For the code blocks replace the `<pre><code>` by only one `<div>`
And use `shj-lang-` prefix instead of `language-` for the class property

```diff
-<pre><code class="language-css">p { color: red }</code></pre>
+<div class="shj-lang-css">p { color: red }</div>
```

And for inline code block you just have to change the class property

```diff
-<code class="language-css">p { color: red }</code>
+<code class="shj-lang-css">p { color: red }</code>
```

## Languages supported 🌐

<!-- AUTOGENERATED:LANGUAGES:START (run `npm run build` to regenerate) -->
| Name | [CSS Class](#web) | Support | Detection | Size (gzip) |
| --- | --- | --- | --- | --- |
| Assembly | `shj-lang-asm` |  | ✅ | [`194 B`](src/languages/asm.js) |
| Bash | `shj-lang-bash` |  | ✅ | [`430 B`](src/languages/bash.js) |
| Brainfuck | `shj-lang-bf` | increment, operator, print, comment | ❌ | [`132 B`](src/languages/bf.js) |
| C | `shj-lang-c` |  | ✅ | [`415 B`](src/languages/c.js) |
| CSS | `shj-lang-css` | comment, str, selector, units, function, ... | ✅ | [`331 B`](src/languages/css.js) |
| CSV | `shj-lang-csv` | punctuation, ... | ❌ | [`95 B`](src/languages/csv.js) |
| Diff | `shj-lang-diff` |  | ✅ | [`144 B`](src/languages/diff.js) |
| Dockerfile | `shj-lang-docker` |  | ✅ | [`563 B`](src/languages/docker.js) |
| Git | `shj-lang-git` | comment, insert, deleted, string, ... | ❌ | [`209 B`](src/languages/git.js) |
| Go | `shj-lang-go` |  | ✅ | [`305 B`](src/languages/go.js) |
| HTML | `shj-lang-html` |  | ✅ | [`611 B`](src/languages/html.js) |
| HTTP | `shj-lang-http` | keywork, string, punctuation, variable, version | ✅ | [`1.0 kB`](src/languages/http.js) |
| INI | `shj-lang-ini` |  | ❌ | [`154 B`](src/languages/ini.js) |
| Java | `shj-lang-java` |  | ✅ | [`421 B`](src/languages/java.js) |
| JavaScript | `shj-lang-js` | basic syntax, regex, jsdoc, json, template literals | ✅ | [`737 B`](src/languages/js.js) |
| JSDoc | `shj-lang-jsdoc` |  | ❌ | [`245 B`](src/languages/jsdoc.js) |
| JSON | `shj-lang-json` | string, number, bool, ... | ✅ | [`172 B`](src/languages/json.js) |
| LeanPub Markdown | `shj-lang-leanpub-md` |  | ❌ | [`1.2 kB`](src/languages/leanpub-md.js) |
| Log | `shj-lang-log` | number, string, comment, errors | ❌ | [`223 B`](src/languages/log.js) |
| Lua | `shj-lang-lua` |  | ✅ | [`266 B`](src/languages/lua.js) |
| Makefile | `shj-lang-make` |  | ✅ | [`210 B`](src/languages/make.js) |
| Markdown | `shj-lang-md` |  | ✅ | [`1.1 kB`](src/languages/md.js) |
| Perl | `shj-lang-pl` |  | ✅ | [`317 B`](src/languages/pl.js) |
| Plain text | `shj-lang-plain` |  | ❌ | [`70 B`](src/languages/plain.js) |
| Python | `shj-lang-py` |  | ✅ | [`402 B`](src/languages/py.js) |
| Regex | `shj-lang-regex` | count, set, ... | ❌ | [`169 B`](src/languages/regex.js) |
| Rust | `shj-lang-rs` |  | ✅ | [`382 B`](src/languages/rs.js) |
| SQL | `shj-lang-sql` | number, string, function, ... | ✅ | [`1.6 kB`](src/languages/sql.js) |
| TODO | `shj-lang-todo` |  | ❌ | [`185 B`](src/languages/todo.js) |
| TOML | `shj-lang-toml` | comment, table, string, bool, variable | ❌ | [`230 B`](src/languages/toml.js) |
| TypeScript | `shj-lang-ts` | js syntax, ts keyword, types | ✅ | [`830 B`](src/languages/ts.js) |
| URI | `shj-lang-uri` |  | ✅ | [`170 B`](src/languages/uri.js) |
| XML | `shj-lang-xml` |  | ✅ | [`495 B`](src/languages/xml.js) |
| YAML | `shj-lang-yaml` | comment, numbers, variable, string, bool | ✅ | [`199 B`](src/languages/yaml.js) |
<!-- AUTOGENERATED:LANGUAGES:END -->

[How to make custom languages](https://github.com/speed-highlight/core/wiki/Create-or-suggest-new-languages)

## Themes 🌈

<!-- AUTOGENERATED:THEMES:START (run `npm run build` to regenerate) -->
| Name | Terminal (gzip) | Web (gzip) |
| --- | --- | --- |
| `default` | ✅ [`170 B`](src/themes/default.js) | ✅ [`583 B`](src/themes/default.css) |
| `atom-dark` | ✅ [`170 B`](src/themes/atom-dark.js) | ✅ [`679 B`](src/themes/atom-dark.css) |
| `github-dark` | ❌ | ✅ [`670 B`](src/themes/github-dark.css) |
| `github-dim` | ❌ | ✅ [`679 B`](src/themes/github-dim.css) |
| `dark` | ❌ | ✅ [`673 B`](src/themes/dark.css) |
| `github-light` | ❌ | ✅ [`651 B`](src/themes/github-light.css) |
| `visual-studio-dark` | ❌ | ✅ [`674 B`](src/themes/visual-studio-dark.css) |
<!-- AUTOGENERATED:THEMES:END -->

[How to make custom themes](https://github.com/speed-highlight/core/wiki/Create-new-themes-styles)
