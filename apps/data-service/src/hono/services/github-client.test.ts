import { afterEach, vi } from "vitest";
import { createIssue, getIssue, listRepos } from "./github-client";

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
