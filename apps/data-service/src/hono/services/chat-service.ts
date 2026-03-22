import Anthropic from "@anthropic-ai/sdk";
import {
	createMessage as createMessageQuery,
	getMessagesByProjectId,
	getProjectBySlug as getProjectBySlugQuery,
	type Message,
	type MessageCreateInput,
} from "@repo/data-ops/project";
import type { Result } from "../types/result";

const DISCOVERY_SYSTEM_PROMPT = `You are an expert discovery interviewer for a software development agency. Your job is to understand the client's project requirements through a structured conversation.

Guide the conversation through these areas:
1. Project overview - What are they building and why?
2. Target users - Who will use this and what problems does it solve?
3. Core features - What are the must-have capabilities?
4. Technical constraints - Any existing systems, platforms, or tech requirements?
5. Timeline and budget - What are the expectations?

Be conversational, ask one question at a time, and dig deeper when answers are vague. Summarize what you've learned periodically to confirm understanding.`;

interface SendMessageResult {
	userMessage: Message;
	assistantMessage: Message;
}

export async function getMessageHistory(slug: string): Promise<Result<Message[]>> {
	const project = await getProjectBySlugQuery(slug);
	if (!project) {
		return {
			ok: false,
			error: { code: "NOT_FOUND", message: "Project not found", status: 404 },
		};
	}
	const messages = await getMessagesByProjectId(project.id);
	return { ok: true, data: messages };
}

export function buildClaudeMessages(
	history: Message[],
	newContent: string,
): Anthropic.MessageParam[] {
	const params: Anthropic.MessageParam[] = history.map((m) => ({
		role: m.role === "assistant" ? "assistant" : "user",
		content: m.content,
	}));
	params.push({ role: "user", content: newContent });
	return params;
}

export async function sendMessage(
	slug: string,
	data: MessageCreateInput,
	apiKey: string,
): Promise<Result<SendMessageResult>> {
	const project = await getProjectBySlugQuery(slug);
	if (!project) {
		return {
			ok: false,
			error: { code: "NOT_FOUND", message: "Project not found", status: 404 },
		};
	}

	const history = await getMessagesByProjectId(project.id);

	const userMessage = await createMessageQuery({
		projectId: project.id,
		role: "user",
		content: data.content,
	});

	const claudeMessages = buildClaudeMessages(history, data.content);

	const client = new Anthropic({ apiKey });
	let assistantContent: string;
	try {
		const response = await client.messages.create({
			model: "claude-sonnet-4-20250514",
			max_tokens: 1024,
			system: DISCOVERY_SYSTEM_PROMPT,
			messages: claudeMessages,
		});
		const textBlock = response.content.find((b) => b.type === "text");
		assistantContent = textBlock?.text ?? "";
	} catch {
		return {
			ok: false,
			error: { code: "AI_ERROR", message: "Failed to get AI response", status: 502 },
		};
	}

	const assistantMessage = await createMessageQuery({
		projectId: project.id,
		role: "assistant",
		content: assistantContent,
	});

	return { ok: true, data: { userMessage, assistantMessage } };
}
