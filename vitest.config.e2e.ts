import { resolve } from "node:path";
import swc from "unplugin-swc";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["**/*.e2e-spec.ts"],
		globals: true,
		root: "./",
	},
	oxc: false,
	plugins: [
		tsconfigPaths(),
		swc.vite({
			module: { type: "es6" },
		}),
	],
	resolve: {
		alias: {
			src: resolve(__dirname, "./src"),
			test: resolve(__dirname, "./test"),
		},
	},
});
