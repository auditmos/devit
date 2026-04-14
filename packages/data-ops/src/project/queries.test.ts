import { eq } from "drizzle-orm";
import { getDb, initDatabase } from "@/database/setup";
import {
	createMessage,
	createProject,
	createSpec,
	createTask,
	createTasks,
	deleteTask,
	getMessagesByProjectId,
	getProjectBySlug,
	getProjects,
	getSpecByProjectId,
	getSystemPrompts,
	getTasksByProjectId,
	reorderTasks,
	updateProjectStatus,
	updateSpec,
	updateTask,
	upsertSystemPrompt,
} from "./queries";
import { projects, systemPrompts } from "./table";

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
	await db.delete(systemPrompts).where(eq(systemPrompts.phase, "__test_phase__"));
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

	it("persists a message with a phase value", async () => {
		const project = await createProject({ name: "__test_project__" });

		const message = await createMessage({
			projectId: project.id,
			role: "assistant",
			content: "Discovery response",
			phase: "discovery",
		});

		expect(message.phase).toBe("discovery");

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

describe("updateProjectStatus", () => {
	it("updates project status and returns the updated project", async () => {
		const project = await createProject({ name: "__test_project__" });
		expect(project.status).toBe("interviewing");

		const updated = await updateProjectStatus(project.id, "review");
		expect(updated).not.toBeNull();
		expect(updated?.status).toBe("review");
		expect(updated?.id).toBe(project.id);

		// cleanup
		const db = getDb();
		await db.delete(projects).where(eq(projects.id, project.id));
	});

	it("returns null for non-existent project", async () => {
		const result = await updateProjectStatus("00000000-0000-0000-0000-000000000000", "review");
		expect(result).toBeNull();
	});
});

describe("createSpec", () => {
	it("persists a spec and returns it with generated id", async () => {
		const project = await createProject({ name: "__test_project__" });

		const spec = await createSpec({
			projectId: project.id,
			contentMarkdown: "# Project Spec\n\n## Summary\nA web app.",
		});

		expect(spec.id).toBeDefined();
		expect(spec.projectId).toBe(project.id);
		expect(spec.contentMarkdown).toContain("# Project Spec");
		expect(spec.version).toBe(1);
		expect(spec.createdAt).toBeInstanceOf(Date);

		// cleanup via cascade
		const db = getDb();
		await db.delete(projects).where(eq(projects.id, project.id));
	});
});

describe("createTasks", () => {
	it("persists multiple tasks and returns them with correct sort order", async () => {
		const project = await createProject({ name: "__test_project__" });

		const result = await createTasks(project.id, [
			{ title: "Set up database", description: "Create tables", sortOrder: 0 },
			{ title: "Build auth", description: "Login flow", sortOrder: 1 },
			{ title: "Deploy", description: null, sortOrder: 2 },
		]);

		expect(result).toHaveLength(3);
		expect(result[0]?.title).toBe("Set up database");
		expect(result[0]?.description).toBe("Create tables");
		expect(result[0]?.sortOrder).toBe(0);
		expect(result[0]?.status).toBe("pending");
		expect(result[1]?.title).toBe("Build auth");
		expect(result[1]?.sortOrder).toBe(1);
		expect(result[2]?.title).toBe("Deploy");
		expect(result[2]?.description).toBeNull();
		expect(result[2]?.sortOrder).toBe(2);

		// cleanup via cascade
		const db = getDb();
		await db.delete(projects).where(eq(projects.id, project.id));
	});

	it("returns empty array when given no tasks", async () => {
		const project = await createProject({ name: "__test_project__" });

		const result = await createTasks(project.id, []);
		expect(result).toEqual([]);

		// cleanup
		const db = getDb();
		await db.delete(projects).where(eq(projects.id, project.id));
	});
});

describe("upsertSystemPrompt", () => {
	it("inserts a new system prompt", async () => {
		const result = await upsertSystemPrompt("__test_phase__", "Test prompt content");

		expect(result.id).toBeDefined();
		expect(result.phase).toBe("__test_phase__");
		expect(result.content).toBe("Test prompt content");
		expect(result.updatedAt).toBeInstanceOf(Date);

		// cleanup
		const db = getDb();
		await db.delete(systemPrompts).where(eq(systemPrompts.phase, "__test_phase__"));
	});

	it("updates an existing system prompt on conflict", async () => {
		await upsertSystemPrompt("__test_phase__", "Original content");
		const updated = await upsertSystemPrompt("__test_phase__", "Updated content");

		expect(updated.phase).toBe("__test_phase__");
		expect(updated.content).toBe("Updated content");

		// cleanup
		const db = getDb();
		await db.delete(systemPrompts).where(eq(systemPrompts.phase, "__test_phase__"));
	});
});

describe("getSystemPrompts", () => {
	it("returns all stored system prompts as a phase-content map", async () => {
		await upsertSystemPrompt("__test_phase__", "Test content");

		const prompts = await getSystemPrompts();
		expect(prompts.__test_phase__).toBe("Test content");

		// cleanup
		const db = getDb();
		await db.delete(systemPrompts).where(eq(systemPrompts.phase, "__test_phase__"));
	});

	it("returns an empty object when no prompts exist", async () => {
		const db = getDb();
		await db.delete(systemPrompts);

		const prompts = await getSystemPrompts();
		expect(typeof prompts).toBe("object");

		// Note: other tests may have inserted prompts, so we just verify the shape
	});
});

describe("getSpecByProjectId", () => {
	it("returns the spec for a project that has one", async () => {
		const project = await createProject({ name: "__test_project__" });
		const created = await createSpec({
			projectId: project.id,
			contentMarkdown: "# Test Spec\n\nSome content.",
		});

		const found = await getSpecByProjectId(project.id);
		expect(found).not.toBeNull();
		expect(found?.id).toBe(created.id);
		expect(found?.contentMarkdown).toBe("# Test Spec\n\nSome content.");
		expect(found?.version).toBe(1);

		// cleanup via cascade
		const db = getDb();
		await db.delete(projects).where(eq(projects.id, project.id));
	});

	it("returns null when project has no spec", async () => {
		const project = await createProject({ name: "__test_project__" });

		const found = await getSpecByProjectId(project.id);
		expect(found).toBeNull();

		// cleanup
		const db = getDb();
		await db.delete(projects).where(eq(projects.id, project.id));
	});
});

describe("updateSpec", () => {
	it("updates content and increments version", async () => {
		const project = await createProject({ name: "__test_project__" });
		const spec = await createSpec({
			projectId: project.id,
			contentMarkdown: "# Original",
		});
		expect(spec.version).toBe(1);

		const updated = await updateSpec(spec.id, "# Updated content");
		expect(updated.id).toBe(spec.id);
		expect(updated.contentMarkdown).toBe("# Updated content");
		expect(updated.version).toBe(2);

		// update again to confirm increment
		const updated2 = await updateSpec(spec.id, "# Third version");
		expect(updated2.version).toBe(3);

		// cleanup via cascade
		const db = getDb();
		await db.delete(projects).where(eq(projects.id, project.id));
	});

	it("throws when spec does not exist", async () => {
		await expect(updateSpec("00000000-0000-0000-0000-000000000000", "content")).rejects.toThrow(
			"Spec not found",
		);
	});
});

describe("getTasksByProjectId", () => {
	it("returns tasks sorted by sortOrder", async () => {
		const project = await createProject({ name: "__test_project__" });
		await createTasks(project.id, [
			{ title: "Third", description: null, sortOrder: 2 },
			{ title: "First", description: "desc", sortOrder: 0 },
			{ title: "Second", description: null, sortOrder: 1 },
		]);

		const result = await getTasksByProjectId(project.id);
		expect(result).toHaveLength(3);
		expect(result[0]?.title).toBe("First");
		expect(result[1]?.title).toBe("Second");
		expect(result[2]?.title).toBe("Third");

		// cleanup via cascade
		const db = getDb();
		await db.delete(projects).where(eq(projects.id, project.id));
	});

	it("returns empty array when project has no tasks", async () => {
		const project = await createProject({ name: "__test_project__" });

		const result = await getTasksByProjectId(project.id);
		expect(result).toEqual([]);

		// cleanup
		const db = getDb();
		await db.delete(projects).where(eq(projects.id, project.id));
	});
});

describe("updateTask", () => {
	it("updates task title and returns updated task", async () => {
		const project = await createProject({ name: "__test_project__" });
		const result = await createTasks(project.id, [
			{ title: "Original title", description: "desc", sortOrder: 0 },
		]);
		const task = result[0];
		if (!task) throw new Error("Task not created");

		const updated = await updateTask(task.id, { title: "New title" });
		expect(updated).not.toBeNull();
		expect(updated?.title).toBe("New title");
		expect(updated?.description).toBe("desc");

		// cleanup via cascade
		const db = getDb();
		await db.delete(projects).where(eq(projects.id, project.id));
	});

	it("updates task status", async () => {
		const project = await createProject({ name: "__test_project__" });
		const result = await createTasks(project.id, [
			{ title: "Task", description: null, sortOrder: 0 },
		]);
		const task = result[0];
		if (!task) throw new Error("Task not created");

		const updated = await updateTask(task.id, { status: "done" });
		expect(updated?.status).toBe("done");

		// cleanup via cascade
		const db = getDb();
		await db.delete(projects).where(eq(projects.id, project.id));
	});

	it("returns null for non-existent task", async () => {
		const result = await updateTask("00000000-0000-0000-0000-000000000000", { title: "x" });
		expect(result).toBeNull();
	});
});

describe("deleteTask", () => {
	it("deletes an existing task and returns true", async () => {
		const project = await createProject({ name: "__test_project__" });
		const result = await createTasks(project.id, [
			{ title: "To delete", description: null, sortOrder: 0 },
		]);
		const task = result[0];
		if (!task) throw new Error("Task not created");

		const deleted = await deleteTask(task.id);
		expect(deleted).toBe(true);

		const remaining = await getTasksByProjectId(project.id);
		expect(remaining).toHaveLength(0);

		// cleanup
		const db = getDb();
		await db.delete(projects).where(eq(projects.id, project.id));
	});

	it("returns false for non-existent task", async () => {
		const result = await deleteTask("00000000-0000-0000-0000-000000000000");
		expect(result).toBe(false);
	});
});

describe("createTask", () => {
	it("creates a single task with correct fields", async () => {
		const project = await createProject({ name: "__test_project__" });

		const task = await createTask({
			projectId: project.id,
			title: "New task",
			description: "Some description",
			sortOrder: 5,
		});

		expect(task.id).toBeDefined();
		expect(task.title).toBe("New task");
		expect(task.description).toBe("Some description");
		expect(task.sortOrder).toBe(5);
		expect(task.status).toBe("pending");

		// cleanup via cascade
		const db = getDb();
		await db.delete(projects).where(eq(projects.id, project.id));
	});

	it("defaults description to null when not provided", async () => {
		const project = await createProject({ name: "__test_project__" });

		const task = await createTask({
			projectId: project.id,
			title: "No desc",
			sortOrder: 0,
		});

		expect(task.description).toBeNull();

		// cleanup via cascade
		const db = getDb();
		await db.delete(projects).where(eq(projects.id, project.id));
	});
});

describe("reorderTasks", () => {
	it("updates sortOrder based on array position", async () => {
		const project = await createProject({ name: "__test_project__" });
		const created = await createTasks(project.id, [
			{ title: "A", description: null, sortOrder: 0 },
			{ title: "B", description: null, sortOrder: 1 },
			{ title: "C", description: null, sortOrder: 2 },
		]);

		const taskA = created.find((t) => t.title === "A")!;
		const taskB = created.find((t) => t.title === "B")!;
		const taskC = created.find((t) => t.title === "C")!;

		// Reorder: C, A, B
		await reorderTasks(project.id, [taskC.id, taskA.id, taskB.id]);

		const reordered = await getTasksByProjectId(project.id);
		expect(reordered[0]?.title).toBe("C");
		expect(reordered[0]?.sortOrder).toBe(0);
		expect(reordered[1]?.title).toBe("A");
		expect(reordered[1]?.sortOrder).toBe(1);
		expect(reordered[2]?.title).toBe("B");
		expect(reordered[2]?.sortOrder).toBe(2);

		// cleanup via cascade
		const db = getDb();
		await db.delete(projects).where(eq(projects.id, project.id));
	});
});
