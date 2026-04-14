import { initDatabase } from "@repo/data-ops/database/setup";
import {
	createProject,
	createSpec,
	createTasks,
	deleteProject,
	getProjectBySlug,
	type Project,
	type Spec,
	type Task,
	updateProjectStatus,
} from "@repo/data-ops/project";
import { App } from "../app";

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

async function setupProject(status?: Project["status"]): Promise<Project> {
	const project = await createProject({ name: "__spec_task_test__" });
	createdIds.push(project.id);
	if (status) {
		await updateProjectStatus(project.id, status);
	}
	return project;
}

async function setupProjectWithSpec(): Promise<{ project: Project; spec: Spec }> {
	const project = await setupProject("review");
	const spec = await createSpec({
		projectId: project.id,
		contentMarkdown: "# Test Spec\n\nContent here.",
	});
	return { project, spec };
}

async function setupProjectWithTasks(): Promise<{ project: Project; tasks: Task[] }> {
	const project = await setupProject("review");
	const tasks = await createTasks(project.id, [
		{ title: "Task A", description: "Desc A", sortOrder: 0 },
		{ title: "Task B", description: null, sortOrder: 1 },
		{ title: "Task C", description: "Desc C", sortOrder: 2 },
	]);
	return { project, tasks };
}

function authHeaders(): Record<string, string> {
	return {
		"Content-Type": "application/json",
		Authorization: "Bearer test-token",
	};
}

// ============================================
// GET /projects/:slug/spec
// ============================================

describe("GET /projects/:slug/spec", () => {
	it("returns spec for project", async () => {
		const { project, spec } = await setupProjectWithSpec();

		const res = await App.request(`/projects/${project.slug}/spec`, { method: "GET" }, TEST_ENV);
		expect(res.status).toBe(200);

		const body = (await res.json()) as Spec;
		expect(body.id).toBe(spec.id);
		expect(body.contentMarkdown).toBe("# Test Spec\n\nContent here.");
	});

	it("returns 404 when project has no spec", async () => {
		const project = await setupProject();

		const res = await App.request(`/projects/${project.slug}/spec`, { method: "GET" }, TEST_ENV);
		expect(res.status).toBe(404);
	});

	it("returns 404 for unknown slug", async () => {
		const res = await App.request("/projects/nonexistent-slug/spec", { method: "GET" }, TEST_ENV);
		expect(res.status).toBe(404);
	});
});

// ============================================
// PUT /projects/:slug/spec
// ============================================

describe("PUT /projects/:slug/spec", () => {
	it("updates spec content and increments version", async () => {
		const { project } = await setupProjectWithSpec();

		const res = await App.request(
			`/projects/${project.slug}/spec`,
			{
				method: "PUT",
				headers: authHeaders(),
				body: JSON.stringify({ contentMarkdown: "# Updated Spec" }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(200);

		const body = (await res.json()) as Spec;
		expect(body.contentMarkdown).toBe("# Updated Spec");
		expect(body.version).toBe(2);
	});

	it("returns 401 without auth token", async () => {
		const { project } = await setupProjectWithSpec();

		const res = await App.request(
			`/projects/${project.slug}/spec`,
			{
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ contentMarkdown: "# No Auth" }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(401);
	});
});

// ============================================
// GET /projects/:slug/tasks
// ============================================

describe("GET /projects/:slug/tasks", () => {
	it("returns tasks sorted by sortOrder", async () => {
		const { project } = await setupProjectWithTasks();

		const res = await App.request(`/projects/${project.slug}/tasks`, { method: "GET" }, TEST_ENV);
		expect(res.status).toBe(200);

		const body = (await res.json()) as Task[];
		expect(body).toHaveLength(3);
		expect(body[0]?.title).toBe("Task A");
		expect(body[1]?.title).toBe("Task B");
		expect(body[2]?.title).toBe("Task C");
	});

	it("returns empty array for project with no tasks", async () => {
		const project = await setupProject();

		const res = await App.request(`/projects/${project.slug}/tasks`, { method: "GET" }, TEST_ENV);
		expect(res.status).toBe(200);

		const body = (await res.json()) as Task[];
		expect(body).toEqual([]);
	});
});

// ============================================
// POST /projects/:slug/tasks
// ============================================

describe("POST /projects/:slug/tasks", () => {
	it("creates a task and returns 201", async () => {
		const project = await setupProject();

		const res = await App.request(
			`/projects/${project.slug}/tasks`,
			{
				method: "POST",
				headers: authHeaders(),
				body: JSON.stringify({ title: "New task", description: "Details" }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(201);

		const body = (await res.json()) as Task;
		expect(body.title).toBe("New task");
		expect(body.description).toBe("Details");
		expect(body.status).toBe("pending");
	});

	it("returns 401 without auth", async () => {
		const project = await setupProject();

		const res = await App.request(
			`/projects/${project.slug}/tasks`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ title: "No auth task" }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(401);
	});
});

// ============================================
// PATCH /projects/:slug/tasks/:taskId
// ============================================

describe("PATCH /projects/:slug/tasks/:taskId", () => {
	it("updates task title", async () => {
		const { project, tasks } = await setupProjectWithTasks();
		const task = tasks[0];
		if (!task) throw new Error("No task");

		const res = await App.request(
			`/projects/${project.slug}/tasks/${task.id}`,
			{
				method: "PATCH",
				headers: authHeaders(),
				body: JSON.stringify({ title: "Renamed" }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(200);

		const body = (await res.json()) as Task;
		expect(body.title).toBe("Renamed");
	});
});

// ============================================
// DELETE /projects/:slug/tasks/:taskId
// ============================================

describe("DELETE /projects/:slug/tasks/:taskId", () => {
	it("deletes task and returns 204", async () => {
		const { project, tasks } = await setupProjectWithTasks();
		const task = tasks[0];
		if (!task) throw new Error("No task");

		const res = await App.request(
			`/projects/${project.slug}/tasks/${task.id}`,
			{
				method: "DELETE",
				headers: authHeaders(),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(204);
	});

	it("returns 404 for non-existent task", async () => {
		const project = await setupProject();

		const res = await App.request(
			`/projects/${project.slug}/tasks/00000000-0000-0000-0000-000000000000`,
			{
				method: "DELETE",
				headers: authHeaders(),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(404);
	});
});

// ============================================
// PUT /projects/:slug/tasks/reorder
// ============================================

describe("PUT /projects/:slug/tasks/reorder", () => {
	it("reorders tasks and returns new order", async () => {
		const { project, tasks } = await setupProjectWithTasks();
		const taskA = tasks.find((t) => t.title === "Task A");
		const taskB = tasks.find((t) => t.title === "Task B");
		const taskC = tasks.find((t) => t.title === "Task C");
		if (!taskA || !taskB || !taskC) throw new Error("Missing tasks");

		const res = await App.request(
			`/projects/${project.slug}/tasks/reorder`,
			{
				method: "PUT",
				headers: authHeaders(),
				body: JSON.stringify({ taskIds: [taskC.id, taskA.id, taskB.id] }),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(200);

		const body = (await res.json()) as Task[];
		expect(body[0]?.title).toBe("Task C");
		expect(body[1]?.title).toBe("Task A");
		expect(body[2]?.title).toBe("Task B");
	});
});

// ============================================
// POST /projects/:slug/approve
// ============================================

describe("POST /projects/:slug/approve", () => {
	it("transitions project from review to active", async () => {
		await setupProjectWithSpec();
		const project = await setupProject("review");

		const res = await App.request(
			`/projects/${project.slug}/approve`,
			{
				method: "POST",
				headers: authHeaders(),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(204);

		const updated = await getProjectBySlug(project.slug);
		expect(updated?.status).toBe("active");
	});

	it("returns 409 when project is not in review status", async () => {
		const project = await setupProject();

		const res = await App.request(
			`/projects/${project.slug}/approve`,
			{
				method: "POST",
				headers: authHeaders(),
			},
			TEST_ENV,
		);
		expect(res.status).toBe(409);
	});

	it("returns 401 without auth", async () => {
		const project = await setupProject("review");

		const res = await App.request(
			`/projects/${project.slug}/approve`,
			{ method: "POST" },
			TEST_ENV,
		);
		expect(res.status).toBe(401);
	});
});
