export default /** @satisfies {import('../index.js').ShjGrammar} */ ([
	{ // js objects
		match: /(("|')((?!\2)[^\r\n\\]|\\[^])*\2|[a-zA-Z]\w*)(?=\s*:)/g
	},
	{ // jsdoc comments
		match: /\/\*\*((?!\*\/)[^])*(\*\/)?/g,
		sub: 'jsdoc'
	},
	{ // comments
		match: /\/\/.*\n?|\/\*((?!\*\/)[^])*(\*\/)?/g,
		sub: 'todo'
	},
	{
		expand: 'str'
	},
	{
		match: /`((?!`)[^]|\\[^])*`?/g,
		type: 'str',
		sub: [
			{
				match: new class {
					exec(str) {
						let i = this.lastIndex,
							j,
							f = _ => {
								while (++i < str.length - 2)
									if (str[i] == '{') f();
									else if (str[i] == '}') return;
							};
						for (; i < str.length; ++i)
							if (str[i - 1] != '\\' && str[i] == '$' && str[i + 1] == '{') {
								j = i++;
								f(i);
								this.lastIndex = i + 1;
								return { index: j, 0: str.slice(j, i + 1) };
							}
						return null;
					}
				}(),
				sub: [
					{
						type: 'kwd',
						match: /^\${|}$/g
					},
					{
						match: /(?!^\$|{)[^]+(?=}$)/g,
						sub: 'js'
					}
				]
			}
		]
	},
	{
		type: 'kwd',
		match: /=>|\b(this|set|get|as|async|await|break|case|catch|class|const|constructor|continue|debugger|default|delete|do|else|enum|export|extends|finally|for|from|function|if|implements|import|in|instanceof|interface|let|var|of|new|package|private|protected|public|return|static|super|switch|throw|throws|try|typeof|void|while|with|yield)\b/g
	},
	{
		match: /\/((?!\/)[^\r\n\\]|\\.)+\/[dgimsuy]*/g,
		sub: 'regex'
	},
	{
		expand: 'num'
	},
	{
		type: 'num',
		match: /\b(NaN|null|undefined|[A-Z][A-Z_]*)\b/g
	},
	{
		type: 'bool',
		match: /\b(true|false)\b/g
	},
	{
		type: 'oper',
		match: /[/*+:?&|%^~=!,<>.^-]+/g
	},
	{
		type: 'class',
		match: /\b[A-Z][\w_]*\b/g
	},
	{
		type: 'func',
		match: /[a-zA-Z$_][\w$_]*(?=\s*((\?\.)?\s*\(|=\s*(\(?[\w,{}\[\])]+\)? =>|function\b)))/g
	}
]);
