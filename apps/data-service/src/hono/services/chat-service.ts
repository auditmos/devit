import Anthropic from "@anthropic-ai/sdk";
import {
	createMessage as createMessageQuery,
	createSpec,
	createTasks,
	getMessagesByProjectId,
	getProjectBySlug as getProjectBySlugQuery,
	type Message,
	type MessageCreateInput,
	updateProjectStatus,
} from "@repo/data-ops/project";
import type { Result } from "../types/result";
import {
	buildSummarizedHistory,
	detectPhaseTransition,
	extractSpec,
	extractTasks,
	getCurrentPhase,
	getSystemPrompt,
} from "./phase-service";

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

const PHASE_MAX_TOKENS: Record<string, number> = {
	discovery: 1024,
	requirements: 4096,
	plan: 4096,
	tasks: 8192,
};

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

	const fullHistory = await getMessagesByProjectId(project.id);
	const currentPhase = getCurrentPhase(fullHistory);
	const systemPrompt = getSystemPrompt(currentPhase);

	const userMessage = await createMessageQuery({
		projectId: project.id,
		role: "user",
		content: data.content,
		phase: currentPhase,
	});

	const history = buildSummarizedHistory(fullHistory);
	const claudeMessages = buildClaudeMessages(history as Message[], data.content);

	const client = new Anthropic({ apiKey });
	let assistantContent: string;
	try {
		const response = await client.messages.create({
			model: "claude-sonnet-4-20250514",
			max_tokens: PHASE_MAX_TOKENS[currentPhase] ?? 1024,
			system: systemPrompt,
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

	const transition = detectPhaseTransition(assistantContent);
	const assistantPhase = transition?.phase ?? currentPhase;

	const assistantMessage = await createMessageQuery({
		projectId: project.id,
		role: "assistant",
		content: assistantContent,
		phase: assistantPhase,
	});

	if (assistantPhase === "tasks" && currentPhase !== "tasks") {
		const specContent = extractSpec(assistantContent);
		if (specContent) {
			await createSpec({ projectId: project.id, contentMarkdown: specContent });
		}

		const parsedTasks = extractTasks(assistantContent);
		if (parsedTasks.length > 0) {
			await createTasks(project.id, parsedTasks);
		}

		await updateProjectStatus(project.id, "review");
	}

	return { ok: true, data: { userMessage, assistantMessage } };
}
