export function readOrdered(data, dataCol = 1) {
	let p = 0;
	const l = data.length - 1;
	return (char) => {
		while (p < l && char >= data[p + 1][0]) {
			++p;
		}
		return data[p][dataCol];
	};
}

export function readNextChangeCharacter(data) {
	let p = 0;
	const l = data.length - 1;
	return (char) => {
		while (p < l && char >= data[p + 1][0]) {
			++p;
		}
		return p < l ? data[p + 1][0] : Number.POSITIVE_INFINITY;
	};
}

export function readRandomAccess(data) {
	const l = data.length;
	return (char) => {
		let low = 0;
		let high = l;
		while (high > low + 1) {
			const mid = (low + high) >> 1;
			if (char >= data[mid][0]) {
				low = mid;
			} else {
				high = mid;
			}
		}
		return data[low][1];
	};
}
