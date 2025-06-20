import { INHERIT } from '../../src/constants.mjs';

export class Compressor {
	constructor(onEntry) {
		this.curW = null;
		this.pending = null;
		this.onEntry = onEntry;
	}

	add(char, w, wBase = null) {
		if (this.pending) {
			if (wBase !== w) {
				this.onEntry(this.pending.char, (this.curW = this.pending.w));
				this.pending = null;
				if (w !== this.curW) {
					this.onEntry(char, (this.curW = w));
				}
			} else if (w !== this.pending.w) {
				this.onEntry(this.pending.char, (this.curW = INHERIT));
				this.pending = null;
			}
		} else if (w !== this.curW) {
			if (wBase !== w) {
				this.onEntry(char, (this.curW = w));
			} else if (this.curW !== INHERIT) {
				this.pending = { w, char };
			}
		}
	}

	close() {
		if (this.pending) {
			this.onEntry(this.pending.char, this.pending.w);
		}
	}
}
