import {
	MessageCreateRequestSchema,
	MessageListResponseSchema,
	ProjectCreateRequestSchema,
	SlugParamSchema,
	SpecUpdateRequestSchema,
	TaskCreateRequestSchema,
	TaskIdParamSchema,
	TaskReorderRequestSchema,
	TaskUpdateRequestSchema,
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

describe("SpecUpdateRequestSchema", () => {
	it("accepts valid content", () => {
		const result = SpecUpdateRequestSchema.safeParse({ contentMarkdown: "# My Spec" });
		expect(result.success).toBe(true);
	});

	it("rejects empty content", () => {
		const result = SpecUpdateRequestSchema.safeParse({ contentMarkdown: "" });
		expect(result.success).toBe(false);
	});

	it("rejects missing contentMarkdown", () => {
		const result = SpecUpdateRequestSchema.safeParse({});
		expect(result.success).toBe(false);
	});
});

describe("TaskCreateRequestSchema", () => {
	it("accepts valid title only", () => {
		const result = TaskCreateRequestSchema.safeParse({ title: "Build auth" });
		expect(result.success).toBe(true);
	});

	it("accepts title with description and sortOrder", () => {
		const result = TaskCreateRequestSchema.safeParse({
			title: "Build auth",
			description: "Login flow",
			sortOrder: 3,
		});
		expect(result.success).toBe(true);
	});

	it("accepts null description", () => {
		const result = TaskCreateRequestSchema.safeParse({
			title: "Task",
			description: null,
		});
		expect(result.success).toBe(true);
	});

	it("rejects empty title", () => {
		const result = TaskCreateRequestSchema.safeParse({ title: "" });
		expect(result.success).toBe(false);
	});

	it("rejects missing title", () => {
		const result = TaskCreateRequestSchema.safeParse({});
		expect(result.success).toBe(false);
	});

	it("rejects title exceeding 200 chars", () => {
		const result = TaskCreateRequestSchema.safeParse({ title: "a".repeat(201) });
		expect(result.success).toBe(false);
	});

	it("rejects negative sortOrder", () => {
		const result = TaskCreateRequestSchema.safeParse({ title: "Task", sortOrder: -1 });
		expect(result.success).toBe(false);
	});

	it("rejects non-integer sortOrder", () => {
		const result = TaskCreateRequestSchema.safeParse({ title: "Task", sortOrder: 1.5 });
		expect(result.success).toBe(false);
	});
});

describe("TaskUpdateRequestSchema", () => {
	it("accepts partial update with title only", () => {
		const result = TaskUpdateRequestSchema.safeParse({ title: "New name" });
		expect(result.success).toBe(true);
	});

	it("accepts partial update with status only", () => {
		const result = TaskUpdateRequestSchema.safeParse({ status: "done" });
		expect(result.success).toBe(true);
	});

	it("accepts empty object (no fields to update)", () => {
		const result = TaskUpdateRequestSchema.safeParse({});
		expect(result.success).toBe(true);
	});

	it("rejects empty title", () => {
		const result = TaskUpdateRequestSchema.safeParse({ title: "" });
		expect(result.success).toBe(false);
	});

	it("rejects title exceeding 200 chars", () => {
		const result = TaskUpdateRequestSchema.safeParse({ title: "a".repeat(201) });
		expect(result.success).toBe(false);
	});
});

describe("TaskIdParamSchema", () => {
	it("accepts valid slug and UUID taskId", () => {
		const result = TaskIdParamSchema.safeParse({
			slug: "my-project-abc123",
			taskId: "550e8400-e29b-41d4-a716-446655440000",
		});
		expect(result.success).toBe(true);
	});

	it("rejects invalid slug", () => {
		const result = TaskIdParamSchema.safeParse({
			slug: "My Project!",
			taskId: "550e8400-e29b-41d4-a716-446655440000",
		});
		expect(result.success).toBe(false);
	});

	it("rejects non-UUID taskId", () => {
		const result = TaskIdParamSchema.safeParse({
			slug: "my-project",
			taskId: "not-a-uuid",
		});
		expect(result.success).toBe(false);
	});

	it("rejects missing fields", () => {
		expect(TaskIdParamSchema.safeParse({}).success).toBe(false);
		expect(TaskIdParamSchema.safeParse({ slug: "abc" }).success).toBe(false);
		expect(
			TaskIdParamSchema.safeParse({ taskId: "550e8400-e29b-41d4-a716-446655440000" }).success,
		).toBe(false);
	});
});

describe("TaskReorderRequestSchema", () => {
	it("accepts array of UUIDs", () => {
		const result = TaskReorderRequestSchema.safeParse({
			taskIds: ["550e8400-e29b-41d4-a716-446655440000", "550e8400-e29b-41d4-a716-446655440001"],
		});
		expect(result.success).toBe(true);
	});

	it("rejects empty array", () => {
		const result = TaskReorderRequestSchema.safeParse({ taskIds: [] });
		expect(result.success).toBe(false);
	});

	it("rejects non-UUID strings", () => {
		const result = TaskReorderRequestSchema.safeParse({ taskIds: ["not-a-uuid"] });
		expect(result.success).toBe(false);
	});

	it("rejects missing taskIds", () => {
		const result = TaskReorderRequestSchema.safeParse({});
		expect(result.success).toBe(false);
	});
});
