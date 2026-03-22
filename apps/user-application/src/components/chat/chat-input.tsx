import { useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface ChatInputProps {
	onSend: (content: string) => void;
	isPending: boolean;
	error?: string;
}

export function ChatInput({ onSend, isPending, error }: ChatInputProps) {
	const [content, setContent] = useState("");
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const trimmed = content.trim();
		if (!trimmed || isPending) return;
		onSend(trimmed);
		setContent("");
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSubmit(e);
		}
	};

	return (
		<div className="border-t bg-background px-4 py-3 shrink-0">
			{error && (
				<Alert variant="destructive" className="mb-3">
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			)}
			<form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex gap-2">
				<textarea
					ref={textareaRef}
					value={content}
					onChange={(e) => setContent(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder="Type your message..."
					disabled={isPending}
					rows={1}
					className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
				/>
				<Button type="submit" disabled={!content.trim() || isPending}>
					{isPending ? "Sending..." : "Send"}
				</Button>
			</form>
		</div>
	);
}
