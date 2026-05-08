import { env } from "cloudflare:workers";
import { PaginationRequestSchema } from "@repo/data-ops/client";
import {
	type ClientViewResponse,
	ClientViewResponseSchema,
	type MessageListResponse,
	MessageListResponseSchema,
	type Project,
	type ProjectCreateInput,
	ProjectCreateRequestSchema,
	type ProjectListResponse,
	ProjectListResponseSchema,
	ProjectSchema,
	type Task,
	TaskSchema,
} from "@repo/data-ops/project";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { AppError } from "@/core/errors";

interface ErrorBody {
	message?: string;
	code?: string;
}

const makeAuthBindingRequest = async (path: string, options: RequestInit = {}) => {
	return env.DATA_SERVICE.fetch(
		new Request(`https://data-service${path}`, {
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${env.DATA_SERVICE_API_TOKEN}`,
				...options.headers,
			},
			...options,
		}),
	);
};

async function throwOnError(response: Response, fallbackMessage: string): Promise<never> {
	const body = (await response.json().catch(() => ({}))) as ErrorBody;
	throw new AppError(body.message || fallbackMessage, body.code || "API_ERROR", response.status);
}

const SlugInput = z.object({ slug: z.string().min(1) });

export const getClientView = createServerFn()
	.inputValidator((data: z.infer<typeof SlugInput>) => SlugInput.parse(data))
	.handler(async (ctx): Promise<ClientViewResponse> => {
		const response = await env.DATA_SERVICE.fetch(
			new Request(`https://data-service/projects/${ctx.data.slug}/client-view`, {
				method: "GET",
				headers: { "Content-Type": "application/json" },
			}),
		);

		if (!response.ok) {
			const body = (await response.json().catch(() => ({}))) as ErrorBody;
			throw new AppError(
				body.message || "Failed to load project",
				body.code || "API_ERROR",
				response.status,
			);
		}

		return ClientViewResponseSchema.parse(await response.json());
	});

export const getProjects = createServerFn()
	.inputValidator((data: z.infer<typeof PaginationRequestSchema>) =>
		PaginationRequestSchema.parse(data),
	)
	.handler(async (ctx): Promise<ProjectListResponse> => {
		const params = new URLSearchParams({
			limit: String(ctx.data.limit),
			offset: String(ctx.data.offset),
		});
		const response = await makeAuthBindingRequest(`/projects?${params}`);
		if (!response.ok) await throwOnError(response, "Failed to fetch projects");
		return ProjectListResponseSchema.parse(await response.json());
	});

export const getProject = createServerFn()
	.inputValidator((data: z.infer<typeof SlugInput>) => SlugInput.parse(data))
	.handler(async (ctx): Promise<Project | null> => {
		const response = await makeAuthBindingRequest(`/projects/${ctx.data.slug}`);
		if (response.status === 404) return null;
		if (!response.ok) await throwOnError(response, "Failed to fetch project");
		return ProjectSchema.parse(await response.json());
	});

export const createProject = createServerFn({ method: "POST" })
	.inputValidator((data: unknown): ProjectCreateInput => ProjectCreateRequestSchema.parse(data))
	.handler(async (ctx): Promise<Project> => {
		const response = await makeAuthBindingRequest("/projects", {
			method: "POST",
			body: JSON.stringify(ctx.data),
		});
		if (!response.ok) await throwOnError(response, "Failed to create project");
		return ProjectSchema.parse(await response.json());
	});

export const getProjectMessages = createServerFn()
	.inputValidator((data: z.infer<typeof SlugInput>) => SlugInput.parse(data))
	.handler(async (ctx): Promise<MessageListResponse> => {
		const response = await makeAuthBindingRequest(`/projects/${ctx.data.slug}/messages`);
		if (!response.ok) await throwOnError(response, "Failed to fetch project messages");
		return MessageListResponseSchema.parse(await response.json());
	});

export const getProjectTasks = createServerFn()
	.inputValidator((data: z.infer<typeof SlugInput>) => SlugInput.parse(data))
	.handler(async (ctx): Promise<Task[]> => {
		const response = await makeAuthBindingRequest(`/projects/${ctx.data.slug}/tasks`);
		if (!response.ok) await throwOnError(response, "Failed to fetch project tasks");
		return z.array(TaskSchema).parse(await response.json());
	});

export const deleteProject = createServerFn({ method: "POST" })
	.inputValidator((data: z.infer<typeof SlugInput>) => SlugInput.parse(data))
	.handler(async (ctx): Promise<void> => {
		const response = await makeAuthBindingRequest(`/projects/${ctx.data.slug}`, {
			method: "DELETE",
		});
		if (!response.ok && response.status !== 204) {
			await throwOnError(response, "Failed to delete project");
		}
	});
