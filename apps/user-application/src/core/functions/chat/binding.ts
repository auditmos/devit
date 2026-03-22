import { env } from "cloudflare:workers";
import { type Message, MessageCreateRequestSchema, MessageSchema } from "@repo/data-ops/project";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { AppError } from "@/core/errors";

interface ErrorBody {
	message?: string;
	code?: string;
}

const makeChatRequest = async (path: string, options: RequestInit = {}) => {
	return env.DATA_SERVICE.fetch(
		new Request(`https://data-service${path}`, {
			headers: {
				"Content-Type": "application/json",
				...options.headers,
			},
			...options,
		}),
	);
};

async function throwOnError(response: Response, fallbackMessage: string): Promise<never> {
	const body = (await response.json().catch(() => ({}))) as ErrorBody;
	throw new AppError(body.message || fallbackMessage, body.code || "API_ERROR", response.status);
}

const SlugInput = z.object({ slug: z.string().min(1) });

export const getChatMessages = createServerFn()
	.inputValidator((data: z.infer<typeof SlugInput>) => SlugInput.parse(data))
	.handler(async (ctx): Promise<Message[]> => {
		const response = await makeChatRequest(`/chat/${ctx.data.slug}/messages`);
		if (!response.ok) await throwOnError(response, "Failed to fetch messages");
		return z.array(MessageSchema).parse(await response.json());
	});

const SendMessageInput = z.object({
	slug: z.string().min(1),
	content: MessageCreateRequestSchema.shape.content,
});

interface SendMessageResponse {
	userMessage: Message;
	assistantMessage: Message;
}

export const sendChatMessage = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => SendMessageInput.parse(data))
	.handler(async (ctx): Promise<SendMessageResponse> => {
		const response = await makeChatRequest(`/chat/${ctx.data.slug}/messages`, {
			method: "POST",
			body: JSON.stringify({ content: ctx.data.content }),
		});
		if (!response.ok) await throwOnError(response, "Failed to send message");
		const body = (await response.json()) as SendMessageResponse;
		return {
			userMessage: MessageSchema.parse(body.userMessage),
			assistantMessage: MessageSchema.parse(body.assistantMessage),
		};
	});
