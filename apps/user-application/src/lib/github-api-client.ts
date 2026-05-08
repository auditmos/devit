import { ErrorResponseSchema } from "@repo/data-ops/client";
import type { Project, Task } from "@repo/data-ops/project";
import { AppError } from "@/core/errors";

const API_URL = import.meta.env.VITE_DATA_SERVICE_URL || "http://localhost:8788";
const API_TOKEN = import.meta.env.VITE_API_TOKEN;

export interface GithubRepo {
	fullName: string;
	defaultBranch: string;
	private: boolean;
}

const getHeaders = (): HeadersInit => {
	const headers: HeadersInit = { "Content-Type": "application/json" };
	if (API_TOKEN) headers.Authorization = `Bearer ${API_TOKEN}`;
	return headers;
};

const handleResponse = async <T>(response: Response): Promise<T> => {
	if (!response.ok) {
		const body = await response.json().catch(() => ({}));
		const parsed = ErrorResponseSchema.safeParse(body);
		const errorData = parsed.success ? parsed.data : {};
		const message = errorData.message || (body as { error?: string }).error || "Request failed";
		throw new AppError(message, errorData.code || "API_ERROR", response.status);
	}
	return response.json();
};

export async function listAvailableRepos(): Promise<GithubRepo[]> {
	const response = await fetch(`${API_URL}/github/repos`, {
		method: "GET",
		headers: getHeaders(),
	});
	return handleResponse<GithubRepo[]>(response);
}

export async function setProjectGithubRepo(slug: string, githubRepo: string): Promise<Project> {
	const response = await fetch(`${API_URL}/projects/${slug}/github-repo`, {
		method: "PUT",
		headers: getHeaders(),
		body: JSON.stringify({ githubRepo }),
	});
	return handleResponse<Project>(response);
}

export async function pushTasksToGithub(slug: string): Promise<Task[]> {
	const response = await fetch(`${API_URL}/github/projects/${slug}/push`, {
		method: "POST",
		headers: getHeaders(),
	});
	return handleResponse<Task[]>(response);
}

export async function syncGithubIssueStatus(slug: string): Promise<Task[]> {
	const response = await fetch(`${API_URL}/github/projects/${slug}/sync`, {
		method: "POST",
		headers: getHeaders(),
	});
	return handleResponse<Task[]>(response);
}
