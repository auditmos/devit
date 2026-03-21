import { eq } from "drizzle-orm";
import { getDb, initDatabase } from "@/database/setup";
import { createProject, getProjectBySlug, getProjects } from "./queries";
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
