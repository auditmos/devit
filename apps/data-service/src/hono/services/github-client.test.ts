import { afterEach, vi } from "vitest";
import { createIssue, createRepo, getIssue, listRepos } from "./github-client";

afterEach(() => {
	vi.restoreAllMocks();
});

describe("getIssue", () => {
	it("returns state for an existing issue", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ number: 7, state: "closed" }), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		);

		const result = await getIssue("ghp_test_token", "octocat/hello", 7);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.data.state).toBe("closed");
	});
});

function mockFetchJson(body: unknown, init: { status?: number } = {}): void {
	const status = init.status ?? 200;
	vi.spyOn(globalThis, "fetch").mockResolvedValue(
		new Response(JSON.stringify(body), {
			status,
			headers: { "content-type": "application/json" },
		}),
	);
}

describe("listRepos", () => {
	it("returns parsed list of repos when GitHub responds 200", async () => {
		mockFetchJson([
			{ full_name: "octocat/hello", default_branch: "main", private: false },
			{ full_name: "octocat/secret", default_branch: "develop", private: true },
		]);

		const result = await listRepos("ghp_test_token");

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.data).toEqual([
			{ fullName: "octocat/hello", defaultBranch: "main", private: false },
			{ fullName: "octocat/secret", defaultBranch: "develop", private: true },
		]);
	});

	it("returns UNAUTHORIZED error when GitHub responds 401", async () => {
		mockFetchJson({ message: "Bad credentials" }, { status: 401 });

		const result = await listRepos("ghp_bad_token");

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe("GITHUB_UNAUTHORIZED");
		expect(result.error.status).toBe(401);
	});
});

describe("createRepo", () => {
	it("creates a private repo under the org and returns parsed GithubRepo", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(
				JSON.stringify({
					full_name: "auditmos-projects/my-project-abcd1234",
					default_branch: "main",
					private: true,
				}),
				{ status: 201, headers: { "content-type": "application/json" } },
			),
		);

		const result = await createRepo("ghp_test_token", "auditmos-projects", "my-project-abcd1234");

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.data).toEqual({
			fullName: "auditmos-projects/my-project-abcd1234",
			defaultBranch: "main",
			private: true,
		});

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		const [url, init] = fetchSpy.mock.calls[0] ?? [];
		expect(url).toBe("https://api.github.com/orgs/auditmos-projects/repos");
		expect(init?.method).toBe("POST");
		const body = JSON.parse((init?.body as string) ?? "{}");
		expect(body.name).toBe("my-project-abcd1234");
		expect(body.private).toBe(true);
		expect(body.auto_init).toBe(false);
	});

	it("returns GITHUB_UNAUTHORIZED error when GitHub responds 401", async () => {
		mockFetchJson({ message: "Bad credentials" }, { status: 401 });

		const result = await createRepo("ghp_bad_token", "auditmos-projects", "any-name");

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe("GITHUB_UNAUTHORIZED");
		expect(result.error.status).toBe(401);
	});

	it("retries with a suffixed name when GitHub responds 422 and returns the repo on success", async () => {
		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						message: "Validation Failed",
						errors: [{ resource: "Repository", code: "custom", field: "name" }],
					}),
					{ status: 422, headers: { "content-type": "application/json" } },
				),
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						full_name: "auditmos-projects/my-project-9f3a",
						default_branch: "main",
						private: true,
					}),
					{ status: 201, headers: { "content-type": "application/json" } },
				),
			);

		const result = await createRepo("ghp_test_token", "auditmos-projects", "my-project");

		expect(fetchSpy).toHaveBeenCalledTimes(2);
		const secondCallInit = fetchSpy.mock.calls[1]?.[1];
		const secondBody = JSON.parse((secondCallInit?.body as string) ?? "{}");
		expect(secondBody.name).toMatch(/^my-project-[0-9a-f]{4}$/);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.data.fullName).toBe("auditmos-projects/my-project-9f3a");
	});

	it("returns GITHUB_REPO_NAME_TAKEN when both initial and retry calls respond 422", async () => {
		const conflict = () =>
			new Response(
				JSON.stringify({
					message: "Validation Failed",
					errors: [{ resource: "Repository", code: "custom", field: "name" }],
				}),
				{ status: 422, headers: { "content-type": "application/json" } },
			);
		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(conflict())
			.mockResolvedValueOnce(conflict());

		const result = await createRepo("ghp_test_token", "auditmos-projects", "taken-name");

		expect(fetchSpy).toHaveBeenCalledTimes(2);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe("GITHUB_REPO_NAME_TAKEN");
		expect(result.error.status).toBe(422);
	});
});

describe("createIssue", () => {
	it("returns issue number, htmlUrl, and state when GitHub responds 201", async () => {
		mockFetchJson(
			{
				number: 42,
				html_url: "https://github.com/octocat/hello/issues/42",
				state: "open",
			},
			{ status: 201 },
		);

		const result = await createIssue("ghp_test_token", "octocat/hello", {
			title: "Bug",
			body: "Details",
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.data).toEqual({
			number: 42,
			htmlUrl: "https://github.com/octocat/hello/issues/42",
			state: "open",
		});
	});
});
