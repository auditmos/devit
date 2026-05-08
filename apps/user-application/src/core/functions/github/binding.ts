import { env } from "cloudflare:workers";
import { type Project, ProjectSchema, type Task, TaskSchema } from "@repo/data-ops/project";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { AppError } from "@/core/errors";

interface ErrorBody {
	message?: string;
	code?: string;
	error?: string;
}

const GithubRepoSchema = z.object({
	fullName: z.string(),
	defaultBranch: z.string(),
	private: z.boolean(),
});
type GithubRepo = z.infer<typeof GithubRepoSchema>;

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
	const message = body.message || body.error || fallbackMessage;
	throw new AppError(message, body.code || "API_ERROR", response.status);
}

const SlugInput = z.object({ slug: z.string().min(1) });

export const listAvailableRepos = createServerFn().handler(async (): Promise<GithubRepo[]> => {
	const response = await makeAuthBindingRequest("/github/repos");
	if (!response.ok) await throwOnError(response, "Failed to fetch repos");
	return z.array(GithubRepoSchema).parse(await response.json());
});

const SetRepoInput = z.object({
	slug: z.string().min(1),
	githubRepo: z.string().min(1),
});

export const setProjectGithubRepo = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => SetRepoInput.parse(data))
	.handler(async (ctx): Promise<Project> => {
		const response = await makeAuthBindingRequest(`/projects/${ctx.data.slug}/github-repo`, {
			method: "PUT",
			body: JSON.stringify({ githubRepo: ctx.data.githubRepo }),
		});
		if (!response.ok) await throwOnError(response, "Failed to set github repo");
		return ProjectSchema.parse(await response.json());
	});

export const pushTasksToGithub = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => SlugInput.parse(data))
	.handler(async (ctx): Promise<Task[]> => {
		const response = await makeAuthBindingRequest(`/github/projects/${ctx.data.slug}/push`, {
			method: "POST",
		});
		if (!response.ok) await throwOnError(response, "Failed to push tasks");
		return z.array(TaskSchema).parse(await response.json());
	});

export const syncGithubIssueStatus = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => SlugInput.parse(data))
	.handler(async (ctx): Promise<Task[]> => {
		const response = await makeAuthBindingRequest(`/github/projects/${ctx.data.slug}/sync`, {
			method: "POST",
		});
		if (!response.ok) await throwOnError(response, "Failed to sync issues");
		return z.array(TaskSchema).parse(await response.json());
	});
