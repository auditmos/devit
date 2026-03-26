import { getDb, initDatabase } from "@repo/data-ops/database/setup";
import { deleteProject, messages } from "@repo/data-ops/project";
import {
	createProject,
	getProjectBySlug,
	getProjectMessages,
	getProjects,
} from "./project-service";

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

describe("createProject", () => {
	it("returns ok result with project data and generated slug", async () => {
		const result = await createProject({ name: "__svc_test_project__" });

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.data.name).toBe("__svc_test_project__");
		expect(result.data.slug).toBeDefined();
		expect(result.data.id).toBeDefined();
		expect(result.data.status).toBe("interviewing");
		createdIds.push(result.data.id);
	});
});

describe("getProjectBySlug", () => {
	it("returns ok result with project for existing slug", async () => {
		const created = await createProject({ name: "__svc_test_slug__" });
		if (!created.ok) throw new Error("setup failed");
		createdIds.push(created.data.id);

		const result = await getProjectBySlug(created.data.slug);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.data.id).toBe(created.data.id);
		expect(result.data.name).toBe("__svc_test_slug__");
	});

	it("returns NOT_FOUND for missing slug", async () => {
		const result = await getProjectBySlug("nonexistent-slug-00000000");

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe("NOT_FOUND");
		expect(result.error.status).toBe(404);
	});
});

describe("getProjects", () => {
	it("returns ok result with paginated data", async () => {
		const result = await getProjects({ limit: 10, offset: 0 });

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.data.data).toBeInstanceOf(Array);
		expect(result.data.pagination).toBeDefined();
		expect(result.data.pagination.limit).toBe(10);
		expect(result.data.pagination.offset).toBe(0);
		expect(typeof result.data.pagination.total).toBe("number");
		expect(typeof result.data.pagination.hasMore).toBe("boolean");
	});
});

describe("getProjectMessages", () => {
	it("returns ok result with messages for existing project", async () => {
		const created = await createProject({ name: "__svc_test_msgs__" });
		if (!created.ok) throw new Error("setup failed");
		createdIds.push(created.data.id);

		const db = getDb();
		await db.insert(messages).values([
			{ projectId: created.data.id, role: "user", content: "Hello from service test" },
			{ projectId: created.data.id, role: "assistant", content: "Hi back" },
		]);

		const result = await getProjectMessages(created.data.slug);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.data.data).toHaveLength(2);
		expect(result.data.data[0]?.role).toBe("user");
		expect(result.data.data[0]?.content).toBe("Hello from service test");
		expect(result.data.data[1]?.role).toBe("assistant");
		expect(result.data.data[1]?.content).toBe("Hi back");
	});

	it("returns NOT_FOUND for missing project slug", async () => {
		const result = await getProjectMessages("nonexistent-slug-00000000");

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe("NOT_FOUND");
		expect(result.error.status).toBe(404);
	});
});

describe("createProject — error handling", () => {
	let querySpy: ReturnType<typeof vi.spyOn>;

	beforeEach(async () => {
		querySpy = vi.spyOn(await import("@repo/data-ops/project"), "createProject");
	});

	afterEach(() => {
		querySpy.mockRestore();
	});

	it("returns CONFLICT when slug already exists", async () => {
		const pgError = new Error("duplicate key value violates unique constraint") as Error & {
			code: string;
		};
		pgError.code = "23505";

		const drizzleError = new Error("Failed query: INSERT INTO projects...");
		drizzleError.cause = pgError;

		querySpy.mockRejectedValueOnce(drizzleError);

		const result = await createProject({ name: "will-collide" });

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe("CONFLICT");
		expect(result.error.status).toBe(409);
		expect(result.error.message).toBe("Slug already exists, please retry");
	});

	it("re-throws non-unique-violation errors", async () => {
		const dbError = new Error("connection refused");
		querySpy.mockRejectedValueOnce(dbError);

		await expect(createProject({ name: "will-fail" })).rejects.toThrow("connection refused");
	});
});
