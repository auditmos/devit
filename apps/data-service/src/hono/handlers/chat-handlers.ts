import { zValidator } from "@hono/zod-validator";
import { MessageCreateRequestSchema, SlugParamSchema } from "@repo/data-ops/project";
import { Hono } from "hono";
import * as chatService from "../services/chat-service";
import { resultToResponse } from "../utils/response";

const chat = new Hono<{ Bindings: Env }>();

chat.get("/:slug/messages", zValidator("param", SlugParamSchema), async (c) => {
	const { slug } = c.req.valid("param");
	return resultToResponse(c, await chatService.getMessageHistory(slug));
});

chat.post(
	"/:slug/messages",
	zValidator("param", SlugParamSchema),
	zValidator("json", MessageCreateRequestSchema),
	async (c) => {
		const { slug } = c.req.valid("param");
		const data = c.req.valid("json");
		return resultToResponse(
			c,
			await chatService.sendMessage(slug, data, c.env.ANTHROPIC_API_KEY),
			201,
		);
	},
);

export default chat;
