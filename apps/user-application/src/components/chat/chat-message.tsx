import type { Message } from "@repo/data-ops/project";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
	message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
	const isAssistant = message.role === "assistant";

	return (
		<div className={cn("flex", isAssistant ? "justify-start" : "justify-end")}>
			<div
				className={cn(
					"max-w-[80%] rounded-lg px-4 py-2.5",
					isAssistant ? "bg-muted text-foreground" : "bg-primary text-primary-foreground",
				)}
			>
				<p className="text-sm whitespace-pre-wrap">{message.content}</p>
			</div>
		</div>
	);
}
