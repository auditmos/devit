import { generateSlug } from "./slug";

describe("generateSlug", () => {
	it("generates a URL-safe slug from a project name", () => {
		const slug = generateSlug("My Cool Project");
		expect(slug).toMatch(/^[a-z0-9-]+$/);
		expect(slug).toContain("my-cool-project");
	});

	it("strips special characters and unicode", () => {
		const slug = generateSlug("Café & Résumé!!");
		expect(slug).toMatch(/^[a-z0-9-]+$/);
		expect(slug).toContain("caf-r-sum");
	});

	it("appends a random suffix for collision resistance", () => {
		const slug = generateSlug("test");
		const parts = slug.split("-");
		const suffix = parts[parts.length - 1];
		expect(suffix).toBeDefined();
		expect(suffix).toHaveLength(8);
		expect(suffix).toMatch(/^[a-f0-9]+$/);
	});

	it("produces different slugs for the same name", () => {
		const slug1 = generateSlug("Same Name");
		const slug2 = generateSlug("Same Name");
		expect(slug1).not.toBe(slug2);
	});
});
