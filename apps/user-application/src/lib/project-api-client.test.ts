import { AppError } from "@/core/errors";
import {
	createProjectApi,
	fetchProject,
	fetchProjectMessages,
	fetchProjects,
} from "./project-api-client";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

afterEach(() => {
	mockFetch.mockReset();
});

describe("fetchProjects", () => {
	it("fetches paginated project list", async () => {
		const mockResponse = {
			data: [
				{
					id: "1",
					name: "Test",
					slug: "test-abc",
					status: "active",
					githubRepo: null,
					createdAt: "2026-03-20T00:00:00Z",
				},
			],
			pagination: { total: 1, limit: 10, offset: 0, hasMore: false },
		};
		mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 200 }));

		const result = await fetchProjects({ limit: 10, offset: 0 });

		expect(result.data).toHaveLength(1);
		expect(result.pagination.total).toBe(1);
		expect(mockFetch).toHaveBeenCalledWith(
			expect.stringContaining("/projects?limit=10&offset=0"),
			expect.objectContaining({ method: "GET" }),
		);
	});

	it("throws AppError on non-ok response", async () => {
		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify({ message: "Server error", code: "INTERNAL" }), { status: 500 }),
		);

		await expect(fetchProjects({ limit: 10, offset: 0 })).rejects.toThrow(AppError);
	});
});

describe("fetchProject", () => {
	it("fetches a project by slug", async () => {
		const mockProject = {
			id: "1",
			name: "Test",
			slug: "test-abc",
			status: "active",
			githubRepo: null,
			createdAt: "2026-03-20T00:00:00Z",
		};
		mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(mockProject), { status: 200 }));

		const result = await fetchProject("test-abc");

		expect(result?.name).toBe("Test");
		expect(mockFetch).toHaveBeenCalledWith(
			expect.stringContaining("/projects/test-abc"),
			expect.objectContaining({ method: "GET" }),
		);
	});

	it("returns null for 404", async () => {
		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify({ code: "NOT_FOUND" }), { status: 404 }),
		);

		const result = await fetchProject("nonexistent");
		expect(result).toBeNull();
	});
});

describe("createProjectApi", () => {
	it("creates a project and returns it", async () => {
		const mockProject = {
			id: "1",
			name: "New Project",
			slug: "new-project-abc",
			status: "interviewing",
			githubRepo: null,
			createdAt: "2026-03-20T00:00:00Z",
		};
		mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(mockProject), { status: 201 }));

		const result = await createProjectApi({ name: "New Project" });

		expect(result.name).toBe("New Project");
		expect(result.slug).toBe("new-project-abc");
		expect(mockFetch).toHaveBeenCalledWith(
			expect.stringContaining("/projects"),
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({ name: "New Project" }),
			}),
		);
	});

	it("throws AppError on conflict", async () => {
		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify({ message: "Slug already exists", code: "CONFLICT" }), {
				status: 409,
			}),
		);

		await expect(createProjectApi({ name: "Duplicate" })).rejects.toThrow(AppError);
	});
});

describe("fetchProjectMessages", () => {
	it("fetches messages for a project by slug", async () => {
		const mockResponse = {
			data: [
				{
					id: "m1",
					projectId: "p1",
					role: "user",
					content: "Hello",
					phase: null,
					createdAt: "2026-03-20T10:00:00Z",
				},
				{
					id: "m2",
					projectId: "p1",
					role: "assistant",
					content: "Hi!",
					phase: "discovery",
					createdAt: "2026-03-20T10:01:00Z",
				},
			],
		};
		mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 200 }));

		const result = await fetchProjectMessages("test-abc");

		expect(result.data).toHaveLength(2);
		expect(result.data[0]?.role).toBe("user");
		expect(mockFetch).toHaveBeenCalledWith(
			expect.stringContaining("/projects/test-abc/messages"),
			expect.objectContaining({ method: "GET" }),
		);
	});

	it("throws AppError on 404", async () => {
		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify({ message: "Project not found", code: "NOT_FOUND" }), {
				status: 404,
			}),
		);

		await expect(fetchProjectMessages("nonexistent")).rejects.toThrow(AppError);
	});
});
