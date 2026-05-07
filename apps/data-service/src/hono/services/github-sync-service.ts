import {
	getProjectBySlug,
	getTasksByProjectId,
	type Task,
	updateTaskGithubIssue,
	updateTaskStatus,
} from "@repo/data-ops/project";
import type { Result } from "../types/result";
import type { createIssue, getIssue } from "./github-client";

export interface PushDeps {
	token: string;
	createIssue: typeof createIssue;
}

export interface SyncDeps {
	token: string;
	getIssue: typeof getIssue;
}

export async function pushTasksToGithub(slug: string, deps: PushDeps): Promise<Result<Task[]>> {
	const project = await getProjectBySlug(slug);
	if (!project)
		return {
			ok: false,
			error: { code: "NOT_FOUND", message: "Project not found", status: 404 },
		};

	if (!project.githubRepo)
		return {
			ok: false,
			error: {
				code: "NO_GITHUB_REPO",
				message: "Project has no githubRepo configured",
				status: 409,
			},
		};

	const tasks = await getTasksByProjectId(project.id);

	for (const task of tasks) {
		if (task.githubIssueNumber !== null) continue;
		const issueResult = await deps.createIssue(deps.token, project.githubRepo, {
			title: task.title,
			body: task.description ?? "",
		});
		if (!issueResult.ok) return issueResult;
		await updateTaskGithubIssue(task.id, {
			number: issueResult.data.number,
			url: issueResult.data.htmlUrl,
		});
	}

	const refreshed = await getTasksByProjectId(project.id);
	return { ok: true, data: refreshed };
}

export async function syncGithubIssueStatus(slug: string, deps: SyncDeps): Promise<Result<Task[]>> {
	const project = await getProjectBySlug(slug);
	if (!project)
		return {
			ok: false,
			error: { code: "NOT_FOUND", message: "Project not found", status: 404 },
		};

	if (!project.githubRepo) {
		const tasks = await getTasksByProjectId(project.id);
		return { ok: true, data: tasks };
	}

	const tasks = await getTasksByProjectId(project.id);
	for (const task of tasks) {
		if (task.githubIssueNumber === null) continue;
		const issueResult = await deps.getIssue(deps.token, project.githubRepo, task.githubIssueNumber);
		if (!issueResult.ok) continue;
		const newStatus = issueResult.data.state === "closed" ? "done" : "pending";
		if (task.status !== newStatus) {
			await updateTaskStatus(task.id, newStatus);
		}
	}

	const refreshed = await getTasksByProjectId(project.id);
	return { ok: true, data: refreshed };
}
