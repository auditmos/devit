import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatMessageList } from "@/components/chat/chat-message-list";
import { sendChatMessage } from "@/core/functions/chat/binding";
import { chatKeys, chatQueries } from "@/lib/query-keys";

export const Route = createFileRoute("/p/$slug")({
	loader: async ({ context, params }) => {
		await context.queryClient.ensureQueryData(chatQueries.messages(params.slug));
	},
	component: ChatPage,
});

function ChatPage() {
	const { slug } = Route.useParams();
	const queryClient = useQueryClient();

	const { data: messages = [], isLoading } = useQuery(chatQueries.messages(slug));

	const mutation = useMutation({
		mutationFn: (content: string) => sendChatMessage({ data: { slug, content } }),
		onSuccess: (result) => {
			queryClient.setQueryData(chatKeys.messages(slug), (old: typeof messages) => [
				...(old ?? []),
				result.userMessage,
				result.assistantMessage,
			]);
		},
	});

	return (
		<div className="flex flex-col h-screen bg-background">
			<header className="border-b px-4 py-3 shrink-0">
				<h1 className="text-lg font-semibold text-foreground">Project Interview</h1>
				<p className="text-sm text-muted-foreground">
					Tell us about your project and we'll help define the requirements.
				</p>
			</header>

			<ChatMessageList messages={messages} isLoading={isLoading} isPending={mutation.isPending} />

			<ChatInput
				onSend={(content) => mutation.mutate(content)}
				isPending={mutation.isPending}
				error={mutation.error?.message}
			/>
		</div>
	);
}
