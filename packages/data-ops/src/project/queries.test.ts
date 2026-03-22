import { eq } from "drizzle-orm";
import { getDb, initDatabase } from "@/database/setup";
import {
	createMessage,
	createProject,
	getMessagesByProjectId,
	getProjectBySlug,
	getProjects,
} from "./queries";
import { projects } from "./table";

beforeAll(() => {
	initDatabase({
		host: process.env.DATABASE_HOST!,
		username: process.env.DATABASE_USERNAME!,
		password: process.env.DATABASE_PASSWORD!,
	});
});

afterAll(async () => {
	const db = getDb();
	await db.delete(projects).where(eq(projects.name, "__test_project__"));
});

describe("createProject", () => {
	it("inserts a project and returns it with a generated slug", async () => {
		const project = await createProject({ name: "__test_project__" });
		expect(project.id).toBeDefined();
		expect(project.name).toBe("__test_project__");
		expect(project.slug).toMatch(/^test-project-[a-f0-9]{8}$/);
		expect(project.status).toBe("interviewing");
		expect(project.githubRepo).toBeNull();
		expect(project.createdAt).toBeInstanceOf(Date);

		// cleanup
		const db = getDb();
		await db.delete(projects).where(eq(projects.id, project.id));
	});
});

describe("getProjectBySlug", () => {
	it("returns project for a valid slug", async () => {
		const created = await createProject({ name: "__test_project__" });
		const found = await getProjectBySlug(created.slug);
		expect(found).not.toBeNull();
		expect(found?.id).toBe(created.id);

		// cleanup
		const db = getDb();
		await db.delete(projects).where(eq(projects.id, created.id));
	});

	it("returns null for unknown slug", async () => {
		const found = await getProjectBySlug("nonexistent-slug-00000000");
		expect(found).toBeNull();
	});
});

describe("getProjects", () => {
	it("returns paginated list with correct metadata", async () => {
		const p1 = await createProject({ name: "__test_project__" });
		const p2 = await createProject({ name: "__test_project__" });

		const result = await getProjects({ limit: 100, offset: 0 });
		expect(result.data.length).toBeGreaterThanOrEqual(2);
		expect(result.pagination.total).toBeGreaterThanOrEqual(2);
		expect(result.pagination.limit).toBe(100);
		expect(result.pagination.offset).toBe(0);
		expect(typeof result.pagination.hasMore).toBe("boolean");

		// cleanup
		const db = getDb();
		await db.delete(projects).where(eq(projects.id, p1.id));
		await db.delete(projects).where(eq(projects.id, p2.id));
	});
});

describe("createMessage", () => {
	it("persists a message and returns it with generated id and timestamps", async () => {
		const project = await createProject({ name: "__test_project__" });

		const message = await createMessage({
			projectId: project.id,
			role: "user",
			content: "Hello, I need help",
		});

		expect(message.id).toBeDefined();
		expect(message.projectId).toBe(project.id);
		expect(message.role).toBe("user");
		expect(message.content).toBe("Hello, I need help");
		expect(message.createdAt).toBeInstanceOf(Date);

		// cleanup via cascade
		const db = getDb();
		await db.delete(projects).where(eq(projects.id, project.id));
	});
});

describe("getMessagesByProjectId", () => {
	it("returns messages ordered by createdAt ascending", async () => {
		const project = await createProject({ name: "__test_project__" });

		await createMessage({ projectId: project.id, role: "user", content: "First" });
		await createMessage({ projectId: project.id, role: "assistant", content: "Second" });
		await createMessage({ projectId: project.id, role: "user", content: "Third" });

		const result = await getMessagesByProjectId(project.id);
		expect(result).toHaveLength(3);
		expect(result[0]?.content).toBe("First");
		expect(result[1]?.content).toBe("Second");
		expect(result[2]?.content).toBe("Third");
		expect(result[0]?.role).toBe("user");
		expect(result[1]?.role).toBe("assistant");

		// cleanup via cascade
		const db = getDb();
		await db.delete(projects).where(eq(projects.id, project.id));
	});

	it("returns empty array for project with no messages", async () => {
		const project = await createProject({ name: "__test_project__" });

		const result = await getMessagesByProjectId(project.id);
		expect(result).toEqual([]);

		// cleanup
		const db = getDb();
		await db.delete(projects).where(eq(projects.id, project.id));
	});
});
