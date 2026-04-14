import { asc, count, eq, sql } from "drizzle-orm";
import type { PaginationRequest } from "@/client/schema";
import { getDb } from "@/database/setup";
import type {
	Message,
	MessageCreateInput,
	Project,
	ProjectCreateInput,
	ProjectListResponse,
	Spec,
	SystemPrompt,
	Task,
} from "./schema";
import { generateSlug } from "./slug";
import { messages, projects, specs, systemPrompts, tasks } from "./table";

export async function createMessage(
	data: MessageCreateInput & { projectId: string; role: Message["role"]; phase?: string },
): Promise<Message> {
	const db = getDb();
	const [message] = await db
		.insert(messages)
		.values({
			projectId: data.projectId,
			role: data.role,
			content: data.content,
			phase: data.phase ?? null,
		})
		.returning();
	if (!message) {
		throw new Error("Failed to create message");
	}
	return message;
}

export async function getMessagesByProjectId(projectId: string): Promise<Message[]> {
	const db = getDb();
	return db
		.select()
		.from(messages)
		.where(eq(messages.projectId, projectId))
		.orderBy(asc(messages.createdAt));
}

export async function createProject(data: ProjectCreateInput): Promise<Project> {
	const db = getDb();
	const slug = generateSlug(data.name);
	const [project] = await db
		.insert(projects)
		.values({
			name: data.name,
			slug,
		})
		.returning();
	if (!project) {
		throw new Error("Failed to create project");
	}
	return project;
}

export async function getProjectBySlug(slug: string): Promise<Project | null> {
	const db = getDb();
	const result = await db.select().from(projects).where(eq(projects.slug, slug));
	return result[0] ?? null;
}

export async function deleteProject(projectId: string): Promise<boolean> {
	const db = getDb();
	const result = await db.delete(projects).where(eq(projects.id, projectId)).returning();
	return result.length > 0;
}

export async function getProjects(params: PaginationRequest): Promise<ProjectListResponse> {
	const db = getDb();
	const [data, countResult] = await Promise.all([
		db.select().from(projects).limit(params.limit).offset(params.offset),
		db.select({ total: count() }).from(projects),
	]);
	const total = countResult[0]?.total ?? 0;
	return {
		data,
		pagination: {
			total,
			limit: params.limit,
			offset: params.offset,
			hasMore: params.offset + data.length < total,
		},
	};
}

export async function updateProjectStatus(
	projectId: string,
	status: Project["status"],
): Promise<Project | null> {
	const db = getDb();
	const [updated] = await db
		.update(projects)
		.set({ status })
		.where(eq(projects.id, projectId))
		.returning();
	return updated ?? null;
}

export async function getSpecByProjectId(projectId: string): Promise<Spec | null> {
	const db = getDb();
	const result = await db.select().from(specs).where(eq(specs.projectId, projectId));
	return result[0] ?? null;
}

export async function updateSpec(specId: string, contentMarkdown: string): Promise<Spec> {
	const db = getDb();
	const [updated] = await db
		.update(specs)
		.set({
			contentMarkdown,
			version: sql`${specs.version} + 1`,
		})
		.where(eq(specs.id, specId))
		.returning();
	if (!updated) {
		throw new Error("Spec not found");
	}
	return updated;
}

export async function createSpec(data: {
	projectId: string;
	contentMarkdown: string;
}): Promise<Spec> {
	const db = getDb();
	const [spec] = await db
		.insert(specs)
		.values({
			projectId: data.projectId,
			contentMarkdown: data.contentMarkdown,
		})
		.returning();
	if (!spec) {
		throw new Error("Failed to create spec");
	}
	return spec;
}

export async function updateTask(
	taskId: string,
	data: Partial<Pick<Task, "title" | "description" | "status">>,
): Promise<Task | null> {
	const db = getDb();
	const [updated] = await db.update(tasks).set(data).where(eq(tasks.id, taskId)).returning();
	return updated ?? null;
}

export async function deleteTask(taskId: string): Promise<boolean> {
	const db = getDb();
	const result = await db.delete(tasks).where(eq(tasks.id, taskId)).returning();
	return result.length > 0;
}

export async function createTask(data: {
	projectId: string;
	title: string;
	description?: string | null;
	sortOrder: number;
}): Promise<Task> {
	const db = getDb();
	const [task] = await db
		.insert(tasks)
		.values({
			projectId: data.projectId,
			title: data.title,
			description: data.description ?? null,
			sortOrder: data.sortOrder,
		})
		.returning();
	if (!task) {
		throw new Error("Failed to create task");
	}
	return task;
}

export async function reorderTasks(_projectId: string, orderedTaskIds: string[]): Promise<void> {
	const db = getDb();
	await Promise.all(
		orderedTaskIds.map((taskId, index) =>
			db.update(tasks).set({ sortOrder: index }).where(eq(tasks.id, taskId)),
		),
	);
}

export async function getTasksByProjectId(projectId: string): Promise<Task[]> {
	const db = getDb();
	return db
		.select()
		.from(tasks)
		.where(eq(tasks.projectId, projectId))
		.orderBy(asc(tasks.sortOrder));
}

interface TaskInput {
	title: string;
	description: string | null;
	sortOrder: number;
}

export async function createTasks(projectId: string, taskInputs: TaskInput[]): Promise<Task[]> {
	if (taskInputs.length === 0) return [];
	const db = getDb();
	return db
		.insert(tasks)
		.values(
			taskInputs.map((t) => ({
				projectId,
				title: t.title,
				description: t.description,
				sortOrder: t.sortOrder,
			})),
		)
		.returning();
}

export async function upsertSystemPrompt(phase: string, content: string): Promise<SystemPrompt> {
	const db = getDb();
	const [result] = await db
		.insert(systemPrompts)
		.values({ phase, content })
		.onConflictDoUpdate({
			target: systemPrompts.phase,
			set: { content, updatedAt: new Date() },
		})
		.returning();
	if (!result) {
		throw new Error("Failed to upsert system prompt");
	}
	return result;
}

export async function getSystemPrompts(): Promise<Record<string, string>> {
	const db = getDb();
	const rows = await db.select().from(systemPrompts);
	const map: Record<string, string> = {};
	for (const row of rows) {
		map[row.phase] = row.content;
	}
	return map;
}
