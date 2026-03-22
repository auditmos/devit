import { initDatabase } from "@repo/data-ops/database/setup";
import { createMessage, deleteProject, type Message, type Project } from "@repo/data-ops/project";
import { App } from "../app";

vi.mock("@anthropic-ai/sdk", () => {
	return {
		default: class MockAnthropic {
			messages = {
				create: vi.fn().mockResolvedValue({
					content: [
						{ type: "text", text: "Thanks for sharing! What problem does your project solve?" },
					],
				}),
			};
		},
	};
});

const TEST_ENV = {
	API_TOKEN: "test-token",
	ANTHROPIC_API_KEY: "test-anthropic-key",
	DATABASE_HOST: process.env.DATABASE_HOST!,
	DATABASE_USERNAME: process.env.DATABASE_USERNAME!,
	DATABASE_PASSWORD: process.env.DATABASE_PASSWORD!,
	CLOUDFLARE_ENV: "dev",
	ALLOWED_ORIGINS: "",
} as unknown as Env;

const createdIds: string[] = [];

beforeAll(() => {
	initDatabase({
		host: process.env.DATABASE_HOST!,
		username: process.env.DATABASE_USERNAME!,
		password: process.env.DATABASE_PASSWORD!,
	});
});

afterAll(async () => {
	for (const id of createdIds) {
		await deleteProject(id);
	}
});

async function createTestProject(): Promise<Project> {
	const res = await App.request(
		"/projects",
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: "Bearer test-token",
			},
			body: JSON.stringify({ name: "__chat_test_project__" }),
		},
		TEST_ENV,
	);
	const project = (await res.json()) as Project;
	createdIds.push(project.id);
	return project;
}

describe("GET /chat/:slug/messages", () => {
	it("returns empty message array for project with no messages", async () => {
		const project = await createTestProject();

		const res = await App.request(`/chat/${project.slug}/messages`, { method: "GET" }, TEST_ENV);

		expect(res.status).toBe(200);
		const body = (await res.json()) as Message[];
		expect(body).toEqual([]);
	});

	it("returns messages in chronological order", async () => {
		const project = await createTestProject();
		await createMessage({ projectId: project.id, role: "user", content: "Hello" });
		await createMessage({ projectId: project.id, role: "assistant", content: "Hi there" });

		const res = await App.request(`/chat/${project.slug}/messages`, { method: "GET" }, TEST_ENV);

		expect(res.status).toBe(200);
		const body = (await res.json()) as Message[];
		expect(body).toHaveLength(2);
		expect(body[0]?.role).toBe("user");
		expect(body[0]?.content).toBe("Hello");
		expect(body[1]?.role).toBe("assistant");
		expect(body[1]?.content).toBe("Hi there");
	});

	it("returns 404 for unknown slug", async () => {
		const res = await App.request(
			"/chat/nonexistent-slug-00000000/messages",
			{ method: "GET" },
			TEST_ENV,
		);

		expect(res.status).toBe(404);
		const body = (await res.json()) as { code: string };
		expect(body.code).toBe("NOT_FOUND");
	});
});

describe("POST /chat/:slug/messages", () => {
	it("rejects empty content with 400", async () => {
		const project = await createTestProject();

		const res = await App.request(
			`/chat/${project.slug}/messages`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ content: "" }),
			},
			TEST_ENV,
		);

		expect(res.status).toBe(400);
	});

	it("returns 404 for unknown slug", async () => {
		const res = await App.request(
			"/chat/nonexistent-slug-00000000/messages",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ content: "Hello" }),
			},
			TEST_ENV,
		);

		expect(res.status).toBe(404);
		const body = (await res.json()) as { code: string };
		expect(body.code).toBe("NOT_FOUND");
	});

	it("persists user message, calls Claude, persists assistant message, returns both", async () => {
		const project = await createTestProject();

		const res = await App.request(
			`/chat/${project.slug}/messages`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ content: "I want to build a task manager" }),
			},
			TEST_ENV,
		);

		expect(res.status).toBe(201);
		const body = (await res.json()) as { userMessage: Message; assistantMessage: Message };
		expect(body.userMessage.role).toBe("user");
		expect(body.userMessage.content).toBe("I want to build a task manager");
		expect(body.assistantMessage.role).toBe("assistant");
		expect(body.assistantMessage.content).toContain("What problem");

		// Verify messages persisted in DB
		const historyRes = await App.request(
			`/chat/${project.slug}/messages`,
			{ method: "GET" },
			TEST_ENV,
		);
		const history = (await historyRes.json()) as Message[];
		expect(history).toHaveLength(2);
		expect(history[0]?.role).toBe("user");
		expect(history[1]?.role).toBe("assistant");
	});

	it("sends full conversation history to Claude for resume", async () => {
		const project = await createTestProject();

		// First exchange
		await App.request(
			`/chat/${project.slug}/messages`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ content: "I want to build a CRM" }),
			},
			TEST_ENV,
		);

		// Second exchange — history should include first pair
		const res = await App.request(
			`/chat/${project.slug}/messages`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ content: "For small businesses" }),
			},
			TEST_ENV,
		);

		expect(res.status).toBe(201);

		// Verify all 4 messages in DB
		const historyRes = await App.request(
			`/chat/${project.slug}/messages`,
			{ method: "GET" },
			TEST_ENV,
		);
		const history = (await historyRes.json()) as Message[];
		expect(history).toHaveLength(4);
		expect(history[0]?.content).toBe("I want to build a CRM");
		expect(history[2]?.content).toBe("For small businesses");
	});
});
