import { resolve } from "node:path";
import swc from "unplugin-swc";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		root: "./",
		exclude: [
			...configDefaults.exclude,
			"**/*.integration-spec.ts",
			"**/*.e2e-spec.ts",
		],
	},
	oxc: false,
	plugins: [
		swc.vite({
			module: { type: "es6" },
		}),
	],
	resolve: {
		tsconfigPaths: true,
		alias: {
			src: resolve(__dirname, "./src"),
		},
	},
});
