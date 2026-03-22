import { ErrorResponseSchema, type PaginationRequest } from "@repo/data-ops/client";
import type {
	MessageListResponse,
	Project,
	ProjectCreateInput,
	ProjectListResponse,
} from "@repo/data-ops/project";
import { AppError } from "@/core/errors";

const API_URL = import.meta.env.VITE_DATA_SERVICE_URL || "http://localhost:8788";
const API_TOKEN = import.meta.env.VITE_API_TOKEN;

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

export async function fetchProjects(params: PaginationRequest): Promise<ProjectListResponse> {
	const searchParams = new URLSearchParams({
		limit: String(params.limit ?? 10),
		offset: String(params.offset ?? 0),
	});

	const response = await fetch(`${API_URL}/projects?${searchParams}`, {
		method: "GET",
		headers: getHeaders(),
	});

	return handleResponse<ProjectListResponse>(response);
}

export async function fetchProject(slug: string): Promise<Project | null> {
	const response = await fetch(`${API_URL}/projects/${slug}`, {
		method: "GET",
		headers: getHeaders(),
	});
	if (response.status === 404) return null;
	return handleResponse<Project>(response);
}

export async function createProjectApi(data: ProjectCreateInput): Promise<Project> {
	const response = await fetch(`${API_URL}/projects`, {
		method: "POST",
		headers: getHeaders(),
		body: JSON.stringify(data),
	});

	return handleResponse<Project>(response);
}

export async function fetchProjectMessages(slug: string): Promise<MessageListResponse> {
	const response = await fetch(`${API_URL}/projects/${slug}/messages`, {
		method: "GET",
		headers: getHeaders(),
	});

	return handleResponse<MessageListResponse>(response);
}
