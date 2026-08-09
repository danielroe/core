/**
 * @name Regex
 * @support count, set, ...
 */
export default /** @satisfies {import('../index.js').ShjLanguageData} */ ({
	type: 'oper',
	sub: [
	{
		match: /^(?!\/).*/gm,
		sub: 'todo'
	},
	{
		type: 'num',
		match: /\[((?!\])[^\\]|\\.)*\]/g
	},
	{
		type: 'kwd',
		match: /\||\^|\$|\\.|\w+($|\r|\n)/g
	},
	{
		type: 'var',
		match: /\*|\+|\{\d+,\d+\}/g
	}
]});
