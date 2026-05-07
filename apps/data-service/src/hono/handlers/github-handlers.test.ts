import { initDatabase } from "@repo/data-ops/database/setup";
import {
	createProject,
	createTasks,
	deleteProject,
	type Project,
	type Task,
	updateProjectGithubRepo,
} from "@repo/data-ops/project";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { App } from "../app";

const TEST_ENV = {
	API_TOKEN: "test-token",
	GITHUB_TOKEN: "ghp_test_token",
	DATABASE_HOST: process.env.DATABASE_HOST!,
	DATABASE_USERNAME: process.env.DATABASE_USERNAME!,
	DATABASE_PASSWORD: process.env.DATABASE_PASSWORD!,
	CLOUDFLARE_ENV: "dev",
	ALLOWED_ORIGINS: "",
} as unknown as Env;

const createdIds: string[] = [];

beforeAll(() => {
	initDatabase({
		host: process.env.DATABASE_HOST!,
		username: process.env.DATABASE_USERNAME!,
		password: process.env.DATABASE_PASSWORD!,
	});
});

afterAll(async () => {
	for (const id of createdIds) {
		await deleteProject(id);
	}
});

afterEach(() => {
	vi.restoreAllMocks();
});

function authHeaders(): Record<string, string> {
	return {
		"Content-Type": "application/json",
		Authorization: "Bearer test-token",
	};
}

async function setupProjectWithRepo(opts: {
	githubRepo?: string | null;
	tasks?: Array<{ title: string; description: string | null }>;
}): Promise<{ project: Project; tasks: Task[] }> {
	const project = await createProject({ name: "__github_test__" });
	createdIds.push(project.id);
	const repo = opts.githubRepo === undefined ? "octocat/hello" : opts.githubRepo;
	if (repo !== null) {
		await updateProjectGithubRepo(project.id, repo);
	}
	const tasks = opts.tasks
		? await createTasks(
				project.id,
				opts.tasks.map((t, i) => ({ ...t, sortOrder: i })),
			)
		: [];
	return { project: { ...project, githubRepo: repo }, tasks };
}

function mockGithubFetch(
	handler: (url: string, init: RequestInit | undefined) => Response | Promise<Response>,
) {
	const original = globalThis.fetch;
	vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
		const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
		if (url.startsWith("https://api.github.com")) {
			return handler(url, init);
		}
		return original(input, init);
	});
}

function mockIssueResponses(
	issues: Array<{ number: number; html_url: string; state?: "open" | "closed" }>,
) {
	let i = 0;
	mockGithubFetch(() => {
		const issue = issues[i++];
		if (!issue) throw new Error("Unexpected GitHub call");
		return new Response(JSON.stringify({ ...issue, state: issue.state ?? "open" }), {
			status: 201,
			headers: { "content-type": "application/json" },
		});
	});
}

describe("POST /github/projects/:slug/push", () => {
	it("creates one GitHub issue per task and stores number/url", async () => {
		const { project, tasks } = await setupProjectWithRepo({
			tasks: [
				{ title: "Task A", description: "First" },
				{ title: "Task B", description: "Second" },
			],
		});
		mockIssueResponses([
			{ number: 11, html_url: "https://github.com/octocat/hello/issues/11" },
			{ number: 12, html_url: "https://github.com/octocat/hello/issues/12" },
		]);

		const res = await App.request(
			`/github/projects/${project.slug}/push`,
			{ method: "POST", headers: authHeaders() },
			TEST_ENV,
		);
		expect(res.status).toBe(200);

		const body = (await res.json()) as Task[];
		expect(body).toHaveLength(2);
		const a = body.find((t) => t.id === tasks[0]?.id);
		const b = body.find((t) => t.id === tasks[1]?.id);
		expect(a?.githubIssueNumber).toBe(11);
		expect(a?.githubIssueUrl).toBe("https://github.com/octocat/hello/issues/11");
		expect(b?.githubIssueNumber).toBe(12);
		expect(b?.githubIssueUrl).toBe("https://github.com/octocat/hello/issues/12");
	});

	it("returns 409 when project has no githubRepo configured", async () => {
		const { project } = await setupProjectWithRepo({
			githubRepo: null,
			tasks: [{ title: "Task", description: null }],
		});

		const res = await App.request(
			`/github/projects/${project.slug}/push`,
			{ method: "POST", headers: authHeaders() },
			TEST_ENV,
		);
		expect(res.status).toBe(409);

		const body = (await res.json()) as { code: string };
		expect(body.code).toBe("NO_GITHUB_REPO");
	});

	it("skips tasks that already have a github issue (idempotent)", async () => {
		const { project, tasks } = await setupProjectWithRepo({
			tasks: [
				{ title: "Already pushed", description: null },
				{ title: "New task", description: null },
			],
		});
		// pre-mark first task as already having an issue
		const firstTask = tasks[0];
		if (!firstTask) throw new Error("missing task");
		const { updateTaskGithubIssue: setIssue } = await import("@repo/data-ops/project");
		await setIssue(firstTask.id, { number: 99, url: "https://github.com/octocat/hello/issues/99" });

		// only ONE github call expected (for second task)
		mockIssueResponses([{ number: 12, html_url: "https://github.com/octocat/hello/issues/12" }]);

		const res = await App.request(
			`/github/projects/${project.slug}/push`,
			{ method: "POST", headers: authHeaders() },
			TEST_ENV,
		);
		expect(res.status).toBe(200);

		const body = (await res.json()) as Task[];
		const a = body.find((t) => t.id === firstTask.id);
		const b = body.find((t) => t.id === tasks[1]?.id);
		expect(a?.githubIssueNumber).toBe(99);
		expect(b?.githubIssueNumber).toBe(12);
	});

	it("returns 401 without auth token", async () => {
		const { project } = await setupProjectWithRepo({});

		const res = await App.request(
			`/github/projects/${project.slug}/push`,
			{ method: "POST" },
			TEST_ENV,
		);
		expect(res.status).toBe(401);
	});
});

describe("POST /github/projects/:slug/sync", () => {
	it("sets status='done' for closed issues and 'pending' for open issues", async () => {
		const { project, tasks } = await setupProjectWithRepo({
			tasks: [
				{ title: "Closed one", description: null },
				{ title: "Open one", description: null },
			],
		});
		const closedTask = tasks[0];
		const openTask = tasks[1];
		if (!closedTask || !openTask) throw new Error("missing tasks");

		const { updateTaskGithubIssue: setIssue } = await import("@repo/data-ops/project");
		await setIssue(closedTask.id, {
			number: 1,
			url: "https://github.com/octocat/hello/issues/1",
		});
		await setIssue(openTask.id, {
			number: 2,
			url: "https://github.com/octocat/hello/issues/2",
		});

		mockGithubFetch((url) => {
			if (url.endsWith("/issues/1")) {
				return new Response(JSON.stringify({ state: "closed" }), {
					status: 200,
					headers: { "content-type": "application/json" },
				});
			}
			return new Response(JSON.stringify({ state: "open" }), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		});

		const res = await App.request(
			`/github/projects/${project.slug}/sync`,
			{ method: "POST" },
			TEST_ENV,
		);
		expect(res.status).toBe(200);

		const body = (await res.json()) as Task[];
		expect(body.find((t) => t.id === closedTask.id)?.status).toBe("done");
		expect(body.find((t) => t.id === openTask.id)?.status).toBe("pending");
	});

	it("skips tasks without a github issue number", async () => {
		const { project, tasks } = await setupProjectWithRepo({
			tasks: [
				{ title: "Linked", description: null },
				{ title: "Not linked yet", description: null },
			],
		});
		const linked = tasks[0];
		const unlinked = tasks[1];
		if (!linked || !unlinked) throw new Error("missing tasks");

		const { updateTaskGithubIssue: setIssue } = await import("@repo/data-ops/project");
		await setIssue(linked.id, {
			number: 7,
			url: "https://github.com/octocat/hello/issues/7",
		});

		mockGithubFetch(() => {
			return new Response(JSON.stringify({ state: "closed" }), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		});

		const res = await App.request(
			`/github/projects/${project.slug}/sync`,
			{ method: "POST" },
			TEST_ENV,
		);
		expect(res.status).toBe(200);

		const body = (await res.json()) as Task[];
		expect(body.find((t) => t.id === linked.id)?.status).toBe("done");
		expect(body.find((t) => t.id === unlinked.id)?.status).toBe("pending");
	});

	it("is public — works without Authorization header", async () => {
		const { project } = await setupProjectWithRepo({
			tasks: [{ title: "T", description: null }],
		});

		const res = await App.request(
			`/github/projects/${project.slug}/sync`,
			{ method: "POST", headers: {} },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
	});
});

describe("GET /github/repos", () => {
	it("returns parsed list of repos from GitHub API", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(
				JSON.stringify([{ full_name: "octocat/hello", default_branch: "main", private: false }]),
				{ status: 200, headers: { "content-type": "application/json" } },
			),
		);

		const res = await App.request(
			"/github/repos",
			{ method: "GET", headers: authHeaders() },
			TEST_ENV,
		);
		expect(res.status).toBe(200);

		const body = (await res.json()) as Array<{
			fullName: string;
			defaultBranch: string;
			private: boolean;
		}>;
		expect(body).toEqual([{ fullName: "octocat/hello", defaultBranch: "main", private: false }]);
	});

	it("returns 401 without auth token", async () => {
		const res = await App.request("/github/repos", { method: "GET" }, TEST_ENV);
		expect(res.status).toBe(401);
	});

	it("propagates 401 from GitHub when token is invalid", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ message: "Bad credentials" }), {
				status: 401,
				headers: { "content-type": "application/json" },
			}),
		);

		const res = await App.request(
			"/github/repos",
			{ method: "GET", headers: authHeaders() },
			TEST_ENV,
		);
		expect(res.status).toBe(401);

		const body = (await res.json()) as { code: string };
		expect(body.code).toBe("GITHUB_UNAUTHORIZED");
	});
});
