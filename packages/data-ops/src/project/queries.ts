import { count, eq } from "drizzle-orm";
import type { PaginationRequest } from "@/client/schema";
import { getDb } from "@/database/setup";
import type { Project, ProjectCreateInput, ProjectListResponse } from "./schema";
import { generateSlug } from "./slug";
import { projects } from "./table";

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
