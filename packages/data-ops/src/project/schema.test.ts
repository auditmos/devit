import {
	MessageCreateRequestSchema,
	MessageListResponseSchema,
	ProjectCreateRequestSchema,
	SlugParamSchema,
} from "./schema";

describe("MessageCreateRequestSchema", () => {
	it("accepts valid content", () => {
		const result = MessageCreateRequestSchema.safeParse({
			content: "Hello, I need help with my project",
		});
		expect(result.success).toBe(true);
	});

	it("rejects empty content", () => {
		const result = MessageCreateRequestSchema.safeParse({ content: "" });
		expect(result.success).toBe(false);
	});

	it("rejects missing content", () => {
		const result = MessageCreateRequestSchema.safeParse({});
		expect(result.success).toBe(false);
	});
});

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

describe("MessageListResponseSchema", () => {
	it("accepts valid message list response", () => {
		const result = MessageListResponseSchema.safeParse({
			data: [
				{
					id: "550e8400-e29b-41d4-a716-446655440000",
					projectId: "550e8400-e29b-41d4-a716-446655440001",
					role: "user",
					content: "Hello, I need help with my project",
					phase: null,
					createdAt: "2026-03-20T10:00:00.000Z",
				},
				{
					id: "550e8400-e29b-41d4-a716-446655440002",
					projectId: "550e8400-e29b-41d4-a716-446655440001",
					role: "assistant",
					content: "Sure, how can I help?",
					phase: "discovery",
					createdAt: "2026-03-20T10:01:00.000Z",
				},
			],
		});
		expect(result.success).toBe(true);
	});

	it("accepts empty data array", () => {
		const result = MessageListResponseSchema.safeParse({ data: [] });
		expect(result.success).toBe(true);
	});

	it("rejects invalid message role", () => {
		const result = MessageListResponseSchema.safeParse({
			data: [
				{
					id: "550e8400-e29b-41d4-a716-446655440000",
					projectId: "550e8400-e29b-41d4-a716-446655440001",
					role: "admin",
					content: "test",
					phase: null,
					createdAt: "2026-03-20T10:00:00.000Z",
				},
			],
		});
		expect(result.success).toBe(false);
	});

	it("rejects missing data field", () => {
		const result = MessageListResponseSchema.safeParse({});
		expect(result.success).toBe(false);
	});
});
