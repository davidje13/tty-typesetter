declare module 'tty-typesetter' {
	type State = unique symbol & { uncertainCodepoints: number };

	interface StateOptions {
		/** skip ANSI escape sequences: return a width of 0 for contained characters (defaults to `true`) */
		skipAnsi?: boolean;
	}

	interface TypesetOptions extends StateOptions {
		/** add hard line wraps if lines are longer than this (defaults to `process.stdout.columns`) */
		columnLimit?: number;
		/** add implicit spaces after emoji which can bleed into the next character if the terminal advances only 1 character (defaults to `true`) */
		padUnsupportedCharacters?: boolean;
		/** split grapheme clusters if they would cause unexpected behaviour in the terminal (defaults to `true`) */
		splitUnsupportedGraphemeClusters?: boolean;
		/** omit soft hyphens from output unless they are at a wrap point (defaults to `true`) */
		softHyphens?: boolean;
		/** apply a crude line wrapping algorithm based on spaces and soft hyphens (defaults to `true`) */
		niceWrap?: boolean;
		/** avoid wrapping inside grapheme clusters, even if they are not supported by the terminal (defaults to `true`) */
		atomicGraphemeClusters?: boolean | 'if-supported';
		/** replace tabs with spaces using this tab size (set to -1 to disable) (defaults to `8`) */
		tabSize?: number;
		/** beginning column for first line, for tab measurements (defaults to `0`) */
		beginColumn?: number;
		/** beginning column for subsequent lines (defaults to `beginColumn`) */
		wrapColumn?: number;
	}

	export class Typesetter {
		constructor(env?: Record<string, string>);

		supportsGraphemeClusters(): boolean;

		measureCodepoint(codepoint: number): number | null;

		measureCharacter(char: string | number): number | null;

		makeState(options?: StateOptions): State;

		measureCodepointStateful(codepoint: number, state: State): number | null;

		measureString(string: string, options?: StateOptions): number;

		measureStringProgressive(
			options?: StateOptions,
		): (char: string | number) => number;

		*typeset(string: string, options?: TypesetOptions): Generator<string>;
	}
}
