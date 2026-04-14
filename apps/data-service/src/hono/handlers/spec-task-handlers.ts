import { zValidator } from "@hono/zod-validator";
import {
	SlugParamSchema,
	SpecUpdateRequestSchema,
	TaskCreateRequestSchema,
	TaskIdParamSchema,
	TaskReorderRequestSchema,
	TaskUpdateRequestSchema,
} from "@repo/data-ops/project";
import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import * as specTaskService from "../services/spec-task-service";
import { resultToResponse } from "../utils/response";

const specTasks = new Hono<{ Bindings: Env }>();

// GET /projects/:slug/spec
specTasks.get("/:slug/spec", zValidator("param", SlugParamSchema), async (c) => {
	const { slug } = c.req.valid("param");
	return resultToResponse(c, await specTaskService.getSpec(slug));
});

// PUT /projects/:slug/spec
specTasks.put(
	"/:slug/spec",
	(c, next) => authMiddleware(c.env.API_TOKEN)(c, next),
	zValidator("param", SlugParamSchema),
	zValidator("json", SpecUpdateRequestSchema),
	async (c) => {
		const { slug } = c.req.valid("param");
		const { contentMarkdown } = c.req.valid("json");
		return resultToResponse(c, await specTaskService.updateSpec(slug, contentMarkdown));
	},
);

// GET /projects/:slug/tasks
specTasks.get("/:slug/tasks", zValidator("param", SlugParamSchema), async (c) => {
	const { slug } = c.req.valid("param");
	return resultToResponse(c, await specTaskService.getTasks(slug));
});

// POST /projects/:slug/tasks
specTasks.post(
	"/:slug/tasks",
	(c, next) => authMiddleware(c.env.API_TOKEN)(c, next),
	zValidator("param", SlugParamSchema),
	zValidator("json", TaskCreateRequestSchema),
	async (c) => {
		const { slug } = c.req.valid("param");
		const data = c.req.valid("json");
		return resultToResponse(c, await specTaskService.createTask(slug, data), 201);
	},
);

// PATCH /projects/:slug/tasks/:taskId
specTasks.patch(
	"/:slug/tasks/:taskId",
	(c, next) => authMiddleware(c.env.API_TOKEN)(c, next),
	zValidator("param", TaskIdParamSchema),
	zValidator("json", TaskUpdateRequestSchema),
	async (c) => {
		const { taskId } = c.req.valid("param");
		const data = c.req.valid("json");
		return resultToResponse(c, await specTaskService.updateTask(taskId, data));
	},
);

// DELETE /projects/:slug/tasks/:taskId
specTasks.delete(
	"/:slug/tasks/:taskId",
	(c, next) => authMiddleware(c.env.API_TOKEN)(c, next),
	zValidator("param", TaskIdParamSchema),
	async (c) => {
		const { taskId } = c.req.valid("param");
		const result = await specTaskService.deleteTask(taskId);
		if (!result.ok) return resultToResponse(c, result);
		return c.body(null, 204);
	},
);

// PUT /projects/:slug/tasks/reorder
specTasks.put(
	"/:slug/tasks/reorder",
	(c, next) => authMiddleware(c.env.API_TOKEN)(c, next),
	zValidator("param", SlugParamSchema),
	zValidator("json", TaskReorderRequestSchema),
	async (c) => {
		const { slug } = c.req.valid("param");
		const { taskIds } = c.req.valid("json");
		return resultToResponse(c, await specTaskService.reorderTasks(slug, taskIds));
	},
);

// POST /projects/:slug/approve
specTasks.post(
	"/:slug/approve",
	(c, next) => authMiddleware(c.env.API_TOKEN)(c, next),
	zValidator("param", SlugParamSchema),
	async (c) => {
		const { slug } = c.req.valid("param");
		const result = await specTaskService.approveSpec(slug);
		if (!result.ok) return resultToResponse(c, result);
		return c.body(null, 204);
	},
);

export default specTasks;
