import { zValidator } from "@hono/zod-validator";
import { PaginationRequestSchema } from "@repo/data-ops/client";
import { ProjectCreateRequestSchema, SlugParamSchema } from "@repo/data-ops/project";
import type { Context } from "hono";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { authMiddleware } from "../middleware/auth";
import * as projectService from "../services/project-service";
import type { Result } from "../types/result";

function resultToResponse<T>(
	c: Context,
	result: Result<T>,
	successStatus: ContentfulStatusCode = 200,
) {
	if (!result.ok)
		return c.json(
			{ error: result.error.message, code: result.error.code },
			result.error.status as ContentfulStatusCode,
		);
	return c.json(result.data, successStatus);
}

const projects = new Hono<{ Bindings: Env }>();

projects.get("/", zValidator("query", PaginationRequestSchema), async (c) => {
	const query = c.req.valid("query");
	return resultToResponse(c, await projectService.getProjects(query));
});

projects.get("/:slug", zValidator("param", SlugParamSchema), async (c) => {
	const { slug } = c.req.valid("param");
	return resultToResponse(c, await projectService.getProjectBySlug(slug));
});

projects.post(
	"/",
	(c, next) => authMiddleware(c.env.API_TOKEN)(c, next),
	zValidator("json", ProjectCreateRequestSchema),
	async (c) => {
		const data = c.req.valid("json");
		return resultToResponse(c, await projectService.createProject(data), 201);
	},
);

export default projects;
