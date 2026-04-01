export const CONVERSATION_PHASES = ["discovery", "requirements", "plan", "tasks"] as const;
export type ConversationPhase = (typeof CONVERSATION_PHASES)[number];

interface PhaseTransition {
	phase: ConversationPhase;
	content: string;
}

const PHASE_MARKER_REGEX = /\[PHASE:([\w]+)\]/;

export function detectPhaseTransition(response: string): PhaseTransition | null {
	const match = PHASE_MARKER_REGEX.exec(response);
	if (!match) return null;

	const phaseName = match[1];
	if (!phaseName || !isValidPhase(phaseName)) return null;

	const content = response.slice(0, match.index).trim();

	return { phase: phaseName, content };
}

function isValidPhase(value: string): value is ConversationPhase {
	return (CONVERSATION_PHASES as readonly string[]).includes(value);
}

const SYSTEM_PROMPTS: Record<ConversationPhase, string> = {
	discovery: `You are an expert discovery interviewer for a software development agency. Your job is to understand the client's project requirements through a structured conversation.

Guide the conversation through these areas:
1. Project overview — What are they building and why?
2. Target users — Who will use this and what problems does it solve?
3. Core features — What are the must-have capabilities?
4. Technical constraints — Any existing systems, platforms, or tech requirements?
5. Timeline and budget — What are the expectations?

Be conversational, ask one question at a time, and dig deeper when answers are vague. Summarize what you've learned periodically to confirm understanding.

When you have gathered sufficient information across all areas and confirmed your understanding with the client, signal the transition by ending your message with [PHASE:requirements] on its own line.`,

	requirements: `You are a requirements analyst synthesizing discovery findings into a structured Product Requirements Document. Write in clear, non-technical language the client can review.

Structure the document with these sections:
1. Project Summary — one-paragraph overview
2. Problem Statement — what problem this solves and for whom
3. User Personas — key user types and their goals
4. Functional Requirements — numbered list of must-have capabilities
5. Non-Functional Requirements — performance, security, scalability expectations
6. Technical Constraints — platforms, integrations, tech requirements
7. Out of Scope — explicitly excluded items
8. Success Criteria — measurable outcomes

Present the document to the client for review. Incorporate their feedback. When the client approves the requirements, signal the transition by ending your message with [PHASE:plan] on its own line.`,

	plan: `You are a technical architect creating an implementation plan from approved requirements. Break the project into logical phases using vertical slices — each phase delivers working, end-to-end functionality.

Structure the plan with:
1. Architecture Overview — high-level system design and key technology choices
2. Phases — numbered phases, each containing:
   - Phase goal (one sentence)
   - Features included (reference requirement numbers)
   - Key technical decisions
   - Dependencies on prior phases
3. Risk Assessment — top risks and mitigations
4. Estimated Effort — relative sizing per phase (S/M/L)

Present the plan to the client for review. Incorporate their feedback. When the client approves the plan, signal the transition by ending your message with [PHASE:tasks] on its own line.`,

	tasks: `You are a project manager breaking an approved implementation plan into actionable development tasks. Each task should be independently assignable and completable.

For each task, provide:
- A clear, imperative title (e.g., "Set up database schema for user accounts")
- A brief description of what needs to be done and any acceptance criteria

Number tasks sequentially. Group them by implementation phase. Order tasks within each phase by dependency — tasks that unblock others come first.

After listing all tasks, output the full project specification as a markdown document between [SPEC_START] and [SPEC_END] markers. The spec should consolidate the requirements and plan into a single reference document.

Then output the task list between [TASKS_START] and [TASKS_END] markers in this format:
[TASKS_START]
1. Task title | Task description
2. Task title | Task description
[TASKS_END]`,
};

export function getSystemPrompt(phase: ConversationPhase): string {
	return SYSTEM_PROMPTS[phase];
}

const SPEC_REGEX = /\[SPEC_START\]\s*([\s\S]*?)\s*\[SPEC_END\]/;

export function extractSpec(response: string): string | null {
	const match = SPEC_REGEX.exec(response);
	if (!match?.[1]) return null;
	return match[1].trim();
}

interface ParsedTask {
	title: string;
	description: string | null;
	sortOrder: number;
}

const TASKS_REGEX = /\[TASKS_START\]\s*([\s\S]*?)\s*\[TASKS_END\]/;
const TASK_LINE_REGEX = /^\d+\.\s*(.+)$/;

export function extractTasks(response: string): ParsedTask[] {
	const blockMatch = TASKS_REGEX.exec(response);
	if (!blockMatch?.[1]) return [];

	const lines = blockMatch[1].split("\n");
	const tasks: ParsedTask[] = [];

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;

		const lineMatch = TASK_LINE_REGEX.exec(trimmed);
		if (!lineMatch?.[1]) continue;

		const parts = lineMatch[1].split("|");
		const title = parts[0]?.trim();
		if (!title) continue;

		const description = parts[1]?.trim() || null;

		tasks.push({ title, description, sortOrder: tasks.length });
	}

	return tasks;
}

export function getCurrentPhase(messages: Array<{ phase: string | null }>): ConversationPhase {
	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i];
		if (msg?.phase && isValidPhase(msg.phase)) {
			return msg.phase;
		}
	}
	return "discovery";
}

export const MESSAGE_THRESHOLD = 50;
const RECENT_MESSAGES_TO_KEEP = 20;

type HistoryMessage = { role: string; content: string; phase: string | null };

export function buildSummarizedHistory(messages: HistoryMessage[]): HistoryMessage[] {
	if (messages.length <= MESSAGE_THRESHOLD) return messages;

	const cutoff = messages.length - RECENT_MESSAGES_TO_KEEP;
	const olderMessages = messages.slice(0, cutoff);
	const recentMessages = messages.slice(cutoff);

	const phaseGroups = new Map<string, string[]>();
	for (const msg of olderMessages) {
		const phase = msg.phase ?? "unknown";
		const existing = phaseGroups.get(phase) ?? [];
		existing.push(`[${msg.role}]: ${msg.content}`);
		phaseGroups.set(phase, existing);
	}

	const summaryParts: string[] = [];
	for (const [phase, contents] of phaseGroups) {
		summaryParts.push(`--- ${phase} phase (${contents.length} messages) ---`);
		for (const line of contents.slice(0, 5)) {
			summaryParts.push(line);
		}
		if (contents.length > 5) {
			summaryParts.push(`... and ${contents.length - 5} more messages`);
		}
	}

	const summaryMessage: HistoryMessage = {
		role: "system",
		content: `Summary of earlier conversation:\n\n${summaryParts.join("\n")}`,
		phase: null,
	};

	return [summaryMessage, ...recentMessages];
}
