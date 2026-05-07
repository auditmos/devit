import { zValidator } from "@hono/zod-validator";
import { SlugParamSchema } from "@repo/data-ops/project";
import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import { createIssue, getIssue, listRepos } from "../services/github-client";
import { pushTasksToGithub, syncGithubIssueStatus } from "../services/github-sync-service";
import { resultToResponse } from "../utils/response";

const github = new Hono<{ Bindings: Env }>();

// GET /github/repos
github.get(
	"/repos",
	(c, next) => authMiddleware(c.env.API_TOKEN)(c, next),
	async (c) => {
		return resultToResponse(c, await listRepos(c.env.GITHUB_TOKEN));
	},
);

// POST /github/projects/:slug/push
github.post(
	"/projects/:slug/push",
	(c, next) => authMiddleware(c.env.API_TOKEN)(c, next),
	zValidator("param", SlugParamSchema),
	async (c) => {
		const { slug } = c.req.valid("param");
		return resultToResponse(
			c,
			await pushTasksToGithub(slug, { token: c.env.GITHUB_TOKEN, createIssue }),
		);
	},
);

// POST /github/projects/:slug/sync (public — called by client tracking page)
github.post("/projects/:slug/sync", zValidator("param", SlugParamSchema), async (c) => {
	const { slug } = c.req.valid("param");
	return resultToResponse(
		c,
		await syncGithubIssueStatus(slug, { token: c.env.GITHUB_TOKEN, getIssue }),
	);
});

export default github;
