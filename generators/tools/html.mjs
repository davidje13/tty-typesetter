function escapeHTML(value) {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll('\n', '<br />');
}

function dom(element, attrs, content) {
	const v = Object.entries(attrs)
		.filter(([, v]) => v)
		.map(([k, v]) => ` ${k}="${escapeHTML(v)}"`)
		.join(' ');
	return `<${element}${v}>${content}</${element}>`;
}

export function toLink(text, url) {
	return dom('a', { href: url, target: '_blank' }, escapeHTML(text));
}

export function toTable(def) {
	return dom(
		'table',
		{ class: def.class },
		`<thead>\n${def.thead.map(toHeadRow).join('\n')}\n</thead><tbody>\n${def.tbody.map(toBodyRow).join('\n')}\n</tbody>`,
	);
}

function toHeadRow(row) {
	const body = row.cells.map((cell) =>
		dom(
			'th',
			{ class: cell.class },
			dom('div', {}, cell.raw ?? escapeHTML(String(cell.content))),
		),
	);
	return dom('tr', { class: row.class }, body.join(''));
}

function toBodyRow(row) {
	const body = row.cells.map((cell) =>
		dom(
			'td',
			{ class: cell.class },
			cell.raw ?? escapeHTML(String(cell.content)),
		),
	);
	return dom('tr', { class: row.class }, body.join(''));
}
