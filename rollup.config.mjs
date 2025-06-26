import terser from '@rollup/plugin-terser';

const plugins = [
	terser({
		format: { ascii_only: true },
		mangle: { properties: { regex: /^_/ } },
	}),
];

export default [
	{
		input: 'src/Typesetter.mjs',
		output: { file: 'build/index.mjs', format: 'esm' },
		plugins,
	},
	{
		input: 'src/measure-tty.mjs',
		output: { file: 'build/bin.mjs', format: 'esm' },
		plugins,
	},
];
