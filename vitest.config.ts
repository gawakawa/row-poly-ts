import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		exclude: [...configDefaults.exclude, '.direnv/**'],
		typecheck: {
			enabled: true,
			exclude: [...configDefaults.exclude, '.direnv/**'],
		},
	},
});
