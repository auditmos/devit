import type { ConversationPhase } from "./phase-service";
import {
	buildSummarizedHistory,
	detectPhaseTransition,
	extractSpec,
	extractTasks,
	getCurrentPhase,
	getSystemPrompt,
	MESSAGE_THRESHOLD,
} from "./phase-service";

type TestMessage = { role: string; content: string; phase: string | null };

function makeMessage(overrides: Partial<TestMessage>): TestMessage {
	return { role: "assistant", content: "", phase: null, ...overrides };
}

function generateLongHistory(count: number, phase = "discovery"): TestMessage[] {
	const msgs: TestMessage[] = [];
	for (let i = 0; i < count; i++) {
		const role = i % 2 === 0 ? "user" : "assistant";
		msgs.push(makeMessage({ role, content: `Message ${i + 1}`, phase }));
	}
	return msgs;
}

describe("buildSummarizedHistory", () => {
	it("returns messages unchanged when count is below threshold", () => {
		const messages = [
			makeMessage({ role: "user", content: "Hello" }),
			makeMessage({ role: "assistant", content: "Hi" }),
		];
		const result = buildSummarizedHistory(messages);
		expect(result).toEqual(messages);
	});

	it("returns messages unchanged when count equals threshold", () => {
		const messages = generateLongHistory(MESSAGE_THRESHOLD);
		const result = buildSummarizedHistory(messages);
		expect(result).toEqual(messages);
	});

	it("summarizes when messages exceed threshold", () => {
		const messages = generateLongHistory(MESSAGE_THRESHOLD + 10);
		const result = buildSummarizedHistory(messages);
		expect(result.length).toBeLessThan(messages.length);
	});

	it("keeps recent messages intact and summarizes older ones", () => {
		const older = generateLongHistory(40, "discovery");
		const recent = generateLongHistory(20, "requirements");
		const allMessages = [...older, ...recent];

		const result = buildSummarizedHistory(allMessages);
		const lastResults = result.slice(-20);
		expect(lastResults).toEqual(recent);
	});

	it("inserts a system summary message at the start", () => {
		const messages = generateLongHistory(MESSAGE_THRESHOLD + 20);
		const result = buildSummarizedHistory(messages);
		const first = result[0];
		expect(first).toBeDefined();
		expect(first?.role).toBe("system");
		expect(first?.content).toContain("Summary of earlier conversation");
	});

	it("summary contains content from the condensed messages", () => {
		const messages = [
			...generateLongHistory(40, "discovery"),
			...generateLongHistory(20, "requirements"),
		];
		const result = buildSummarizedHistory(messages);
		const summary = result[0];
		expect(summary?.content).toContain("discovery");
	});
});

describe("getCurrentPhase", () => {
	it("returns discovery when there are no messages", () => {
		expect(getCurrentPhase([])).toBe("discovery");
	});

	it("returns discovery when no messages have a phase set", () => {
		const messages = [
			makeMessage({ role: "user", content: "Hello" }),
			makeMessage({ role: "assistant", content: "Hi there" }),
		];
		expect(getCurrentPhase(messages)).toBe("discovery");
	});

	it("returns the phase of the last message that has a phase", () => {
		const messages = [
			makeMessage({ role: "assistant", content: "Q1", phase: "discovery" }),
			makeMessage({ role: "user", content: "A1" }),
			makeMessage({ role: "assistant", content: "Moving on", phase: "requirements" }),
			makeMessage({ role: "user", content: "Looks good" }),
		];
		expect(getCurrentPhase(messages)).toBe("requirements");
	});

	it("ignores earlier phases and uses the latest", () => {
		const messages = [
			makeMessage({ role: "assistant", phase: "discovery" }),
			makeMessage({ role: "assistant", phase: "requirements" }),
			makeMessage({ role: "assistant", phase: "plan" }),
		];
		expect(getCurrentPhase(messages)).toBe("plan");
	});
});

describe("extractTasks", () => {
	it("returns empty array when no task markers are present", () => {
		const result = extractTasks("Just a regular response.");
		expect(result).toEqual([]);
	});

	it("parses numbered tasks with title and description", () => {
		const response = `Here are the tasks:

[TASKS_START]
1. Set up database schema | Create tables for users, projects, and tasks with proper relations
2. Implement auth flow | Add login, registration, and session management
3. Build dashboard UI | Create the main dashboard with project listing
[TASKS_END]`;

		const result = extractTasks(response);
		expect(result).toHaveLength(3);
		expect(result[0]).toEqual({
			title: "Set up database schema",
			description: "Create tables for users, projects, and tasks with proper relations",
			sortOrder: 0,
		});
		expect(result[1]).toEqual({
			title: "Implement auth flow",
			description: "Add login, registration, and session management",
			sortOrder: 1,
		});
		expect(result[2]).toEqual({
			title: "Build dashboard UI",
			description: "Create the main dashboard with project listing",
			sortOrder: 2,
		});
	});

	it("handles tasks without descriptions", () => {
		const response = `[TASKS_START]
1. Set up database schema
2. Implement auth flow
[TASKS_END]`;

		const result = extractTasks(response);
		expect(result).toHaveLength(2);
		expect(result[0]).toEqual({
			title: "Set up database schema",
			description: null,
			sortOrder: 0,
		});
	});

	it("returns empty array when only TASKS_START is present", () => {
		const response = "[TASKS_START]\n1. Incomplete";
		const result = extractTasks(response);
		expect(result).toEqual([]);
	});

	it("skips blank lines inside the task block", () => {
		const response = `[TASKS_START]
1. First task | Description one

2. Second task | Description two
[TASKS_END]`;

		const result = extractTasks(response);
		expect(result).toHaveLength(2);
		expect(result[0]?.title).toBe("First task");
		expect(result[1]?.title).toBe("Second task");
	});

	it("trims whitespace from titles and descriptions", () => {
		const response = `[TASKS_START]
1.  Spaced title  |  Spaced description
[TASKS_END]`;

		const result = extractTasks(response);
		expect(result[0]).toEqual({
			title: "Spaced title",
			description: "Spaced description",
			sortOrder: 0,
		});
	});
});

describe("extractSpec", () => {
	it("returns null when no spec markers are present", () => {
		const result = extractSpec("Just a regular response with no spec.");
		expect(result).toBeNull();
	});

	it("extracts markdown content between SPEC_START and SPEC_END markers", () => {
		const response = `Here are the tasks.

[SPEC_START]
# Project Spec

## Summary
A web application for managing inventory.

## Requirements
1. User authentication
2. Product CRUD
[SPEC_END]

And here are the tasks:`;

		const result = extractSpec(response);
		expect(result).toContain("# Project Spec");
		expect(result).toContain("## Summary");
		expect(result).toContain("2. Product CRUD");
	});

	it("trims whitespace from extracted spec", () => {
		const response = "[SPEC_START]\n  \n# Spec\n\nContent here.\n  \n[SPEC_END]";
		const result = extractSpec(response);
		expect(result).toBe("# Spec\n\nContent here.");
	});

	it("returns null when only SPEC_START is present without SPEC_END", () => {
		const response = "[SPEC_START]\n# Incomplete spec";
		const result = extractSpec(response);
		expect(result).toBeNull();
	});

	it("returns null when only SPEC_END is present without SPEC_START", () => {
		const response = "Some content\n[SPEC_END]";
		const result = extractSpec(response);
		expect(result).toBeNull();
	});
});

describe("getSystemPrompt", () => {
	it("returns a non-empty prompt for each valid phase", () => {
		const phases: ConversationPhase[] = ["discovery", "requirements", "plan", "tasks"];
		for (const phase of phases) {
			const prompt = getSystemPrompt(phase);
			expect(prompt).toBeTruthy();
			expect(typeof prompt).toBe("string");
			expect(prompt.length).toBeGreaterThan(50);
		}
	});

	it("returns different prompts for each phase", () => {
		const discovery = getSystemPrompt("discovery");
		const requirements = getSystemPrompt("requirements");
		const plan = getSystemPrompt("plan");
		const tasks = getSystemPrompt("tasks");

		const prompts = new Set([discovery, requirements, plan, tasks]);
		expect(prompts.size).toBe(4);
	});

	it("discovery prompt focuses on interviewing the client", () => {
		const prompt = getSystemPrompt("discovery");
		expect(prompt.toLowerCase()).toMatch(/interview|discover|understand/);
	});

	it("requirements prompt focuses on structuring a PRD/spec", () => {
		const prompt = getSystemPrompt("requirements");
		expect(prompt.toLowerCase()).toMatch(/requirement|spec|document/);
	});

	it("plan prompt focuses on implementation planning", () => {
		const prompt = getSystemPrompt("plan");
		expect(prompt.toLowerCase()).toMatch(/plan|implement|phase/);
	});

	it("tasks prompt focuses on breaking down into actionable tasks", () => {
		const prompt = getSystemPrompt("tasks");
		expect(prompt.toLowerCase()).toMatch(/task|break|action/);
	});

	it("each prompt instructs the AI to use phase markers for transitions", () => {
		const phases: ConversationPhase[] = ["discovery", "requirements", "plan"];
		for (const phase of phases) {
			const prompt = getSystemPrompt(phase);
			expect(prompt).toContain("[PHASE:");
		}
	});
});

describe("detectPhaseTransition", () => {
	it("returns null when no phase marker is present", () => {
		const result = detectPhaseTransition("Tell me more about your target users.");
		expect(result).toBeNull();
	});

	it("detects transition to requirements phase", () => {
		const response =
			"Great, I have a solid understanding of your project. Let me now compile the requirements.\n\n[PHASE:requirements]";
		const result = detectPhaseTransition(response);
		expect(result).toEqual({
			phase: "requirements",
			content:
				"Great, I have a solid understanding of your project. Let me now compile the requirements.",
		});
	});

	it("detects transition to plan phase", () => {
		const response =
			"Here are the finalized requirements. Now let me create an implementation plan.\n\n[PHASE:plan]";
		const result = detectPhaseTransition(response);
		expect(result).toEqual({
			phase: "plan",
			content: "Here are the finalized requirements. Now let me create an implementation plan.",
		});
	});

	it("detects transition to tasks phase", () => {
		const response = "The plan is complete. Let me break this into tasks.\n\n[PHASE:tasks]";
		const result = detectPhaseTransition(response);
		expect(result).toEqual({
			phase: "tasks",
			content: "The plan is complete. Let me break this into tasks.",
		});
	});

	it("ignores invalid phase names", () => {
		const response = "Some text [PHASE:invalid]";
		const result = detectPhaseTransition(response);
		expect(result).toBeNull();
	});

	it("extracts content before the phase marker, trimmed", () => {
		const response = "  Summary of findings.  \n\n  [PHASE:requirements]  ";
		const result = detectPhaseTransition(response);
		expect(result).toEqual({
			phase: "requirements",
			content: "Summary of findings.",
		});
	});

	it("handles marker in the middle of text", () => {
		const response = "Transitioning now. [PHASE:plan] More text after marker.";
		const result = detectPhaseTransition(response);
		expect(result).toEqual({
			phase: "plan",
			content: "Transitioning now.",
		});
	});

	it("returns discovery as a valid transition target", () => {
		const response = "Let me restart discovery. [PHASE:discovery]";
		const result = detectPhaseTransition(response);
		expect(result).toEqual({
			phase: "discovery",
			content: "Let me restart discovery.",
		});
	});
});
