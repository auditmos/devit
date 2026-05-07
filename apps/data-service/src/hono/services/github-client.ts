import type { Result } from "../types/result";

export interface GithubRepo {
	fullName: string;
	defaultBranch: string;
	private: boolean;
}

export interface GithubIssue {
	number: number;
	htmlUrl: string;
	state: "open" | "closed";
}

const GITHUB_API_BASE = "https://api.github.com";

function authHeaders(token: string): Record<string, string> {
	return {
		Authorization: `Bearer ${token}`,
		Accept: "application/vnd.github+json",
		"User-Agent": "devit-data-service",
	};
}

function unauthorizedError() {
	return {
		ok: false as const,
		error: {
			code: "GITHUB_UNAUTHORIZED",
			message: "GitHub token is invalid or missing required scopes",
			status: 401,
		},
	};
}

export async function listRepos(token: string): Promise<Result<GithubRepo[]>> {
	const response = await fetch(`${GITHUB_API_BASE}/user/repos?per_page=100`, {
		headers: authHeaders(token),
	});
	if (response.status === 401) return unauthorizedError();
	const body = (await response.json()) as Array<{
		full_name: string;
		default_branch: string;
		private: boolean;
	}>;
	return {
		ok: true,
		data: body.map((r) => ({
			fullName: r.full_name,
			defaultBranch: r.default_branch,
			private: r.private,
		})),
	};
}

export async function createIssue(
	token: string,
	repoFullName: string,
	input: { title: string; body: string },
): Promise<Result<GithubIssue>> {
	const response = await fetch(`${GITHUB_API_BASE}/repos/${repoFullName}/issues`, {
		method: "POST",
		headers: { ...authHeaders(token), "Content-Type": "application/json" },
		body: JSON.stringify({ title: input.title, body: input.body }),
	});
	if (response.status === 401) return unauthorizedError();
	const body = (await response.json()) as {
		number: number;
		html_url: string;
		state: "open" | "closed";
	};
	return {
		ok: true,
		data: { number: body.number, htmlUrl: body.html_url, state: body.state },
	};
}

export async function getIssue(
	token: string,
	repoFullName: string,
	issueNumber: number,
): Promise<Result<{ state: "open" | "closed" }>> {
	const response = await fetch(`${GITHUB_API_BASE}/repos/${repoFullName}/issues/${issueNumber}`, {
		headers: authHeaders(token),
	});
	if (response.status === 401) return unauthorizedError();
	const body = (await response.json()) as { state: "open" | "closed" };
	return { ok: true, data: { state: body.state } };
}
