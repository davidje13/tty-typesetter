export function getUnicodeBasePath(version) {
	return `https://www.unicode.org/Public/${version}`;
}

export function getUnicodeEmojiBasePath(version) {
	if (Number(version.split('.')[0]) >= 17) {
		return getUnicodeBasePath(version) + '/emoji';
	} else {
		const shortUV = /^(\d+\.\d+)\..*$/.exec(version)[1];
		return `https://www.unicode.org/Public/emoji/${shortUV}`;
	}
}
