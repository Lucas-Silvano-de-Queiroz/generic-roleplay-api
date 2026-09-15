import { resolve } from "node:path";
import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

try {
	process.loadEnvFile(".env");
} catch {
	// .env is optional; CI may provide the variables directly
}
process.env.NODE_ENV = "development";

export default defineConfig({
	test: {
		include: ["**/*.e2e-spec.ts", "**/*.integration-spec.ts"],
		globals: true,
		root: "./",
		testTimeout: 30_000,
		hookTimeout: 30_000,
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
			test: resolve(__dirname, "./test"),
		},
	},
});
