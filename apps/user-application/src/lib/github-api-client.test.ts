import { AppError } from "@/core/errors";
import {
	listAvailableRepos,
	pushTasksToGithub,
	setProjectGithubRepo,
	syncGithubIssueStatus,
} from "./github-api-client";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

afterEach(() => {
	mockFetch.mockReset();
});

describe("listAvailableRepos", () => {
	it("fetches the list of GitHub repos available to the admin", async () => {
		const mockResponse = [
			{ fullName: "octocat/hello", defaultBranch: "main", private: false },
			{ fullName: "octocat/world", defaultBranch: "main", private: true },
		];
		mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 200 }));

		const result = await listAvailableRepos();

		expect(result).toHaveLength(2);
		expect(result[0]?.fullName).toBe("octocat/hello");
		expect(mockFetch).toHaveBeenCalledWith(
			expect.stringContaining("/github/repos"),
			expect.objectContaining({ method: "GET" }),
		);
	});

	it("throws AppError when GitHub token is unauthorized", async () => {
		mockFetch.mockResolvedValueOnce(
			new Response(
				JSON.stringify({ message: "GitHub token invalid", code: "GITHUB_UNAUTHORIZED" }),
				{ status: 401 },
			),
		);

		await expect(listAvailableRepos()).rejects.toThrow(AppError);
	});
});

describe("setProjectGithubRepo", () => {
	it("PUTs the selected repo and returns the updated project", async () => {
		const mockProject = {
			id: "p1",
			name: "Test",
			slug: "test-abc",
			status: "review",
			githubRepo: "octocat/hello",
			createdAt: "2026-04-01T00:00:00Z",
		};
		mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(mockProject), { status: 200 }));

		const result = await setProjectGithubRepo("test-abc", "octocat/hello");

		expect(result.githubRepo).toBe("octocat/hello");
		expect(mockFetch).toHaveBeenCalledWith(
			expect.stringContaining("/projects/test-abc/github-repo"),
			expect.objectContaining({
				method: "PUT",
				body: JSON.stringify({ githubRepo: "octocat/hello" }),
			}),
		);
	});

	it("throws AppError when the project is not found", async () => {
		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify({ message: "Project not found", code: "NOT_FOUND" }), {
				status: 404,
			}),
		);

		await expect(setProjectGithubRepo("nonexistent", "octocat/hello")).rejects.toThrow(AppError);
	});
});

describe("pushTasksToGithub", () => {
	it("POSTs to the push endpoint and returns the refreshed task list with issue links", async () => {
		const mockTasks = [
			{
				id: "t1",
				projectId: "p1",
				title: "Task A",
				description: null,
				status: "pending",
				githubIssueNumber: 42,
				githubIssueUrl: "https://github.com/octocat/hello/issues/42",
				sortOrder: 0,
				createdAt: "2026-04-01T00:00:00Z",
			},
		];
		mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(mockTasks), { status: 200 }));

		const result = await pushTasksToGithub("test-abc");

		expect(result).toHaveLength(1);
		expect(result[0]?.githubIssueNumber).toBe(42);
		expect(mockFetch).toHaveBeenCalledWith(
			expect.stringContaining("/github/projects/test-abc/push"),
			expect.objectContaining({ method: "POST" }),
		);
	});

	it("throws AppError when the project has no githubRepo configured", async () => {
		mockFetch.mockResolvedValueOnce(
			new Response(
				JSON.stringify({ message: "Project has no githubRepo", code: "NO_GITHUB_REPO" }),
				{ status: 409 },
			),
		);

		await expect(pushTasksToGithub("test-abc")).rejects.toThrow(AppError);
	});
});

describe("syncGithubIssueStatus", () => {
	it("POSTs to the sync endpoint and returns refreshed task statuses", async () => {
		const mockTasks = [
			{
				id: "t1",
				projectId: "p1",
				title: "Task A",
				description: null,
				status: "done",
				githubIssueNumber: 42,
				githubIssueUrl: "https://github.com/octocat/hello/issues/42",
				sortOrder: 0,
				createdAt: "2026-04-01T00:00:00Z",
			},
		];
		mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(mockTasks), { status: 200 }));

		const result = await syncGithubIssueStatus("test-abc");

		expect(result).toHaveLength(1);
		expect(result[0]?.status).toBe("done");
		expect(mockFetch).toHaveBeenCalledWith(
			expect.stringContaining("/github/projects/test-abc/sync"),
			expect.objectContaining({ method: "POST" }),
		);
	});

	it("throws AppError when the project is not found", async () => {
		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify({ message: "Project not found", code: "NOT_FOUND" }), {
				status: 404,
			}),
		);

		await expect(syncGithubIssueStatus("nonexistent")).rejects.toThrow(AppError);
	});
});
