import type { Message } from "@repo/data-ops/project";
import { buildClaudeMessages } from "./chat-service";

function makeMessage(
	overrides: Partial<Message> & { role: Message["role"]; content: string },
): Message {
	return {
		id: crypto.randomUUID(),
		projectId: crypto.randomUUID(),
		phase: null,
		createdAt: new Date(),
		...overrides,
	};
}

describe("buildClaudeMessages", () => {
	it("builds messages array from empty history plus new content", () => {
		const result = buildClaudeMessages([], "Hello");
		expect(result).toEqual([{ role: "user", content: "Hello" }]);
	});

	it("includes full conversation history before new message", () => {
		const history: Message[] = [
			makeMessage({ role: "user", content: "First" }),
			makeMessage({ role: "assistant", content: "Response" }),
		];

		const result = buildClaudeMessages(history, "Second");
		expect(result).toEqual([
			{ role: "user", content: "First" },
			{ role: "assistant", content: "Response" },
			{ role: "user", content: "Second" },
		]);
	});

	it("maps system role messages to user role for Claude API", () => {
		const history: Message[] = [makeMessage({ role: "system", content: "System note" })];

		const result = buildClaudeMessages(history, "Hello");
		expect(result[0]?.role).toBe("user");
		expect(result[0]?.content).toBe("System note");
	});

	it("preserves message order from history", () => {
		const history: Message[] = [
			makeMessage({ role: "user", content: "A" }),
			makeMessage({ role: "assistant", content: "B" }),
			makeMessage({ role: "user", content: "C" }),
			makeMessage({ role: "assistant", content: "D" }),
		];

		const result = buildClaudeMessages(history, "E");
		expect(result).toHaveLength(5);
		expect(result.map((m) => m.content)).toEqual(["A", "B", "C", "D", "E"]);
	});
});
