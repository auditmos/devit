import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineProject } from "vitest/config";

function loadDevVars(): Record<string, string> {
	const content = readFileSync(resolve(import.meta.dirname, ".dev.vars"), "utf-8");
	const env: Record<string, string> = {};
	for (const line of content.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const eqIdx = trimmed.indexOf("=");
		if (eqIdx === -1) continue;
		const key = trimmed.slice(0, eqIdx).trim();
		const raw = trimmed.slice(eqIdx + 1).trim();
		env[key] = raw.replace(/^["']|["']$/g, "");
	}
	return env;
}

export default defineProject({
	resolve: { alias: { "@": resolve(import.meta.dirname, "src") } },
	test: {
		globals: true,
		include: ["src/**/*.test.ts"],
		env: loadDevVars(),
	},
});
