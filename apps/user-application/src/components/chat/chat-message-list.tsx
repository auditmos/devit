import type { Message } from "@repo/data-ops/project";
import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage } from "./chat-message";

interface ChatMessageListProps {
	messages: Message[];
	isLoading: boolean;
	isPending: boolean;
}

export function ChatMessageList({ messages, isLoading, isPending }: ChatMessageListProps) {
	const bottomRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, []);

	if (isLoading) {
		return (
			<div className="flex-1 flex items-center justify-center">
				<div className="flex items-center gap-2 text-muted-foreground">
					<div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
					<span>Loading conversation...</span>
				</div>
			</div>
		);
	}

	if (messages.length === 0 && !isPending) {
		return (
			<div className="flex-1 flex items-center justify-center p-8">
				<div className="text-center max-w-md">
					<p className="text-lg font-medium text-foreground">Welcome!</p>
					<p className="text-muted-foreground mt-1">
						Send a message to start the discovery interview. We'll ask questions to understand your
						project requirements.
					</p>
				</div>
			</div>
		);
	}

	return (
		<ScrollArea className="flex-1">
			<div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
				{messages.map((message) => (
					<ChatMessage key={message.id} message={message} />
				))}
				{isPending && (
					<div className="flex items-center gap-2 text-muted-foreground py-2">
						<div className="animate-spin h-3 w-3 border-2 border-primary border-t-transparent rounded-full" />
						<span className="text-sm">Thinking...</span>
					</div>
				)}
				<div ref={bottomRef} />
			</div>
		</ScrollArea>
	);
}
