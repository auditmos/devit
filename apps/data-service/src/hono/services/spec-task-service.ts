import {
	createTask as createTaskQuery,
	deleteTask as deleteTaskQuery,
	getProjectBySlug as getProjectBySlugQuery,
	getSpecByProjectId,
	getTasksByProjectId,
	reorderTasks as reorderTasksQuery,
	type Spec,
	type Task,
	type TaskCreateInput,
	type TaskUpdateInput,
	updateProjectStatus,
	updateSpec as updateSpecQuery,
	updateTask as updateTaskQuery,
} from "@repo/data-ops/project";
import type { Result } from "../types/result";

async function resolveProject(slug: string) {
	const project = await getProjectBySlugQuery(slug);
	if (!project)
		return {
			ok: false as const,
			error: { code: "NOT_FOUND", message: "Project not found", status: 404 },
		};
	return { ok: true as const, data: project };
}

export async function getSpec(slug: string): Promise<Result<Spec>> {
	const projectResult = await resolveProject(slug);
	if (!projectResult.ok) return projectResult;

	const spec = await getSpecByProjectId(projectResult.data.id);
	if (!spec)
		return {
			ok: false,
			error: { code: "NOT_FOUND", message: "Spec not found", status: 404 },
		};
	return { ok: true, data: spec };
}

export async function updateSpec(slug: string, contentMarkdown: string): Promise<Result<Spec>> {
	const projectResult = await resolveProject(slug);
	if (!projectResult.ok) return projectResult;

	const spec = await getSpecByProjectId(projectResult.data.id);
	if (!spec)
		return {
			ok: false,
			error: { code: "NOT_FOUND", message: "Spec not found", status: 404 },
		};

	const updated = await updateSpecQuery(spec.id, contentMarkdown);
	return { ok: true, data: updated };
}

export async function getTasks(slug: string): Promise<Result<Task[]>> {
	const projectResult = await resolveProject(slug);
	if (!projectResult.ok) return projectResult;

	const data = await getTasksByProjectId(projectResult.data.id);
	return { ok: true, data };
}

export async function createTask(slug: string, input: TaskCreateInput): Promise<Result<Task>> {
	const projectResult = await resolveProject(slug);
	if (!projectResult.ok) return projectResult;

	const existingTasks = await getTasksByProjectId(projectResult.data.id);
	const sortOrder = input.sortOrder ?? existingTasks.length;

	const task = await createTaskQuery({
		projectId: projectResult.data.id,
		title: input.title,
		description: input.description ?? null,
		sortOrder,
	});
	return { ok: true, data: task };
}

export async function updateTask(taskId: string, input: TaskUpdateInput): Promise<Result<Task>> {
	const updated = await updateTaskQuery(taskId, input);
	if (!updated)
		return {
			ok: false,
			error: { code: "NOT_FOUND", message: "Task not found", status: 404 },
		};
	return { ok: true, data: updated };
}

export async function deleteTask(taskId: string): Promise<Result<null>> {
	const deleted = await deleteTaskQuery(taskId);
	if (!deleted)
		return {
			ok: false,
			error: { code: "NOT_FOUND", message: "Task not found", status: 404 },
		};
	return { ok: true, data: null };
}

export async function reorderTasks(slug: string, taskIds: string[]): Promise<Result<Task[]>> {
	const projectResult = await resolveProject(slug);
	if (!projectResult.ok) return projectResult;

	await reorderTasksQuery(projectResult.data.id, taskIds);
	const reordered = await getTasksByProjectId(projectResult.data.id);
	return { ok: true, data: reordered };
}

export async function approveSpec(slug: string): Promise<Result<null>> {
	const projectResult = await resolveProject(slug);
	if (!projectResult.ok) return projectResult;

	if (projectResult.data.status !== "review")
		return {
			ok: false,
			error: {
				code: "INVALID_STATE",
				message: "Project must be in 'review' status to approve",
				status: 409,
			},
		};

	await updateProjectStatus(projectResult.data.id, "active");
	return { ok: true, data: null };
}
