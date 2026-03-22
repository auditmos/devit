import { getDb, initDatabase } from "@repo/data-ops/database/setup";
import type { MessageListResponse, Project, ProjectListResponse } from "@repo/data-ops/project";
import { deleteProject, messages } from "@repo/data-ops/project";
import { App } from "../app";

const TEST_ENV = {
	API_TOKEN: "test-token",
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

describe("POST /projects", () => {
	it("creates a project and returns 201 with slug", async () => {
		const res = await App.request(
			"/projects",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: "Bearer test-token",
				},
				body: JSON.stringify({ name: "__api_test_project__" }),
			},
			TEST_ENV,
		);

		expect(res.status).toBe(201);
		const body = (await res.json()) as Project;
		expect(body.name).toBe("__api_test_project__");
		expect(body.slug).toBeDefined();
		expect(body.status).toBe("interviewing");
		createdIds.push(body.id);
	});

	it("rejects empty name with 400", async () => {
		const res = await App.request(
			"/projects",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: "Bearer test-token",
				},
				body: JSON.stringify({ name: "" }),
			},
			TEST_ENV,
		);

		expect(res.status).toBe(400);
	});

	it("rejects unauthenticated request with 401", async () => {
		const res = await App.request(
			"/projects",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: "Test" }),
			},
			TEST_ENV,
		);

		expect(res.status).toBe(401);
	});
});

describe("GET /projects", () => {
	it("returns paginated project list", async () => {
		const res = await App.request(
			"/projects",
			{
				method: "GET",
			},
			TEST_ENV,
		);

		expect(res.status).toBe(200);
		const body = (await res.json()) as ProjectListResponse;
		expect(body.data).toBeInstanceOf(Array);
		expect(body.pagination).toBeDefined();
		expect(body.pagination.limit).toBe(10);
		expect(body.pagination.offset).toBe(0);
	});
});

describe("GET /projects/:slug", () => {
	it("returns project for valid slug", async () => {
		const createRes = await App.request(
			"/projects",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: "Bearer test-token",
				},
				body: JSON.stringify({ name: "__api_test_project__" }),
			},
			TEST_ENV,
		);
		const created = (await createRes.json()) as Project;
		createdIds.push(created.id);

		const res = await App.request(
			`/projects/${created.slug}`,
			{
				method: "GET",
			},
			TEST_ENV,
		);

		expect(res.status).toBe(200);
		const body = (await res.json()) as Project;
		expect(body.id).toBe(created.id);
		expect(body.name).toBe("__api_test_project__");
	});

	it("returns 404 for unknown slug", async () => {
		const res = await App.request(
			"/projects/nonexistent-slug-00000000",
			{
				method: "GET",
			},
			TEST_ENV,
		);

		expect(res.status).toBe(404);
		const body = (await res.json()) as { code: string };
		expect(body.code).toBe("NOT_FOUND");
	});
});

describe("GET /projects/:slug/messages", () => {
	it("returns messages for a project", async () => {
		const createRes = await App.request(
			"/projects",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: "Bearer test-token",
				},
				body: JSON.stringify({ name: "__api_test_project__" }),
			},
			TEST_ENV,
		);
		const created = (await createRes.json()) as Project;
		createdIds.push(created.id);

		// insert test messages directly
		const db = getDb();
		await db.insert(messages).values([
			{ projectId: created.id, role: "user", content: "Hello" },
			{ projectId: created.id, role: "assistant", content: "Hi there" },
		]);

		const res = await App.request(
			`/projects/${created.slug}/messages`,
			{ method: "GET" },
			TEST_ENV,
		);

		expect(res.status).toBe(200);
		const body = (await res.json()) as MessageListResponse;
		expect(body.data.length).toBe(2);
		expect(body.data[0]?.role).toBe("user");
		expect(body.data[0]?.content).toBe("Hello");
		expect(body.data[1]?.role).toBe("assistant");
		expect(body.data[1]?.content).toBe("Hi there");
	});

	it("returns empty array for project with no messages", async () => {
		const createRes = await App.request(
			"/projects",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: "Bearer test-token",
				},
				body: JSON.stringify({ name: "__api_test_project__" }),
			},
			TEST_ENV,
		);
		const created = (await createRes.json()) as Project;
		createdIds.push(created.id);

		const res = await App.request(
			`/projects/${created.slug}/messages`,
			{ method: "GET" },
			TEST_ENV,
		);

		expect(res.status).toBe(200);
		const body = (await res.json()) as MessageListResponse;
		expect(body.data).toEqual([]);
	});

	it("returns 404 for unknown project slug", async () => {
		const res = await App.request(
			"/projects/nonexistent-slug-00000000/messages",
			{ method: "GET" },
			TEST_ENV,
		);

		expect(res.status).toBe(404);
		const body = (await res.json()) as { code: string };
		expect(body.code).toBe("NOT_FOUND");
	});
});
