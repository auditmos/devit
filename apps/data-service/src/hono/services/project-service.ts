import type { PaginationRequest } from "@repo/data-ops/client";
import {
	createProject as createProjectQuery,
	getProjectBySlug as getProjectBySlugQuery,
	getProjects as getProjectsQuery,
	type Project,
	type ProjectCreateInput,
	type ProjectListResponse,
} from "@repo/data-ops/project";
import type { Result } from "../types/result";

function isUniqueViolation(error: unknown): boolean {
	if (!(error instanceof Error)) return false;
	const cause = error.cause;
	if (cause instanceof Error) {
		const pgCode = (cause as Error & { code?: string }).code;
		if (pgCode === "23505") return true;
	}
	return false;
}

export async function createProject(data: ProjectCreateInput): Promise<Result<Project>> {
	try {
		const project = await createProjectQuery(data);
		return { ok: true, data: project };
	} catch (error) {
		if (isUniqueViolation(error)) {
			return {
				ok: false,
				error: {
					code: "CONFLICT",
					message: "Slug already exists, please retry",
					status: 409,
				},
			};
		}
		throw error;
	}
}

export async function getProjectBySlug(slug: string): Promise<Result<Project>> {
	const project = await getProjectBySlugQuery(slug);
	if (!project)
		return {
			ok: false,
			error: { code: "NOT_FOUND", message: "Project not found", status: 404 },
		};
	return { ok: true, data: project };
}

export async function getProjects(params: PaginationRequest): Promise<Result<ProjectListResponse>> {
	const data = await getProjectsQuery(params);
	return { ok: true, data };
}
