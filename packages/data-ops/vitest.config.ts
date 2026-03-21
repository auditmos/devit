import { resolve } from "node:path";
import { loadEnv } from "vite";
import { defineProject } from "vitest/config";

export default defineProject({
	resolve: { alias: { "@": resolve(import.meta.dirname, "src") } },
	test: {
		globals: true,
		include: ["src/**/*.test.ts"],
		exclude: ["src/drizzle/migrations/**"],
		env: loadEnv("dev", import.meta.dirname, ""),
	},
});
