import { ProjectCreateRequestSchema, SlugParamSchema } from "./schema";

describe("ProjectCreateRequestSchema", () => {
	it("accepts valid name", () => {
		const result = ProjectCreateRequestSchema.safeParse({ name: "My Project" });
		expect(result.success).toBe(true);
	});

	it("rejects empty name", () => {
		const result = ProjectCreateRequestSchema.safeParse({ name: "" });
		expect(result.success).toBe(false);
	});

	it("rejects missing name", () => {
		const result = ProjectCreateRequestSchema.safeParse({});
		expect(result.success).toBe(false);
	});

	it("rejects name exceeding 100 chars", () => {
		const result = ProjectCreateRequestSchema.safeParse({ name: "a".repeat(101) });
		expect(result.success).toBe(false);
	});
});

describe("SlugParamSchema", () => {
	it("accepts valid slug", () => {
		const result = SlugParamSchema.safeParse({ slug: "my-project-a1b2c3d4" });
		expect(result.success).toBe(true);
	});

	it("rejects empty slug", () => {
		const result = SlugParamSchema.safeParse({ slug: "" });
		expect(result.success).toBe(false);
	});

	it("rejects slug with invalid characters", () => {
		const result = SlugParamSchema.safeParse({ slug: "my project!" });
		expect(result.success).toBe(false);
	});

	it("rejects missing slug", () => {
		const result = SlugParamSchema.safeParse({});
		expect(result.success).toBe(false);
	});
});
