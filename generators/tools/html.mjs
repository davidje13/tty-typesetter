function escapeHTML(value) {
	return String(value)
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
		.join('');
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
		cell
			? dom(
					'th',
					{ class: cell.class, colspan: cell.colspan, rowspan: cell.rowspan },
					dom('div', {}, cell.raw ?? escapeHTML(cell.content)),
				)
			: '',
	);
	return dom('tr', { class: row.class }, body.join(''));
}

function toBodyRow(row) {
	const body = row.cells.map((cell) =>
		cell
			? dom(
					'td',
					{ class: cell.class, colspan: cell.colspan, rowspan: cell.rowspan },
					cell.raw ?? escapeHTML(cell.content),
				)
			: '',
	);
	return dom('tr', { class: row.class }, body.join(''));
}
