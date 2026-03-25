import type { Message } from "@repo/data-ops/project";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Bot, Calendar, MessageSquare, User } from "lucide-react";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchProject, fetchProjectMessages } from "@/lib/project-api-client";

function projectQueryOptions(slug: string) {
	return queryOptions({
		queryKey: ["projects", slug],
		queryFn: () => fetchProject(slug),
	});
}

function messagesQueryOptions(slug: string) {
	return queryOptions({
		queryKey: ["projects", slug, "messages"],
		queryFn: () => fetchProjectMessages(slug),
	});
}

export const Route = createFileRoute("/_auth/app/projects/$slug")({
	loader: async ({ params, context }) => {
		await Promise.all([
			context.queryClient.ensureQueryData(projectQueryOptions(params.slug)),
			context.queryClient.ensureQueryData(messagesQueryOptions(params.slug)),
		]);
	},
	component: ProjectDetailPage,
});

const STATUS_BADGE_VARIANT: Record<string, "default" | "secondary" | "warning" | "success"> = {
	interviewing: "default",
	review: "warning",
	active: "success",
	complete: "secondary",
};

function formatDate(date: string | Date): string {
	return new Date(date).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

function formatTime(date: string | Date): string {
	return new Date(date).toLocaleTimeString("en-US", {
		hour: "2-digit",
		minute: "2-digit",
	});
}

function ProjectDetailPage() {
	const { slug } = Route.useParams();

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-4">
				<Button variant="ghost" size="icon" asChild>
					<Link to="/app">
						<ArrowLeft className="h-4 w-4 text-foreground" />
					</Link>
				</Button>
				<h1 className="text-2xl font-bold tracking-tight text-foreground">Project Details</h1>
			</div>

			<Suspense fallback={<ProjectDetailSkeleton />}>
				<ProjectHeader slug={slug} />
				<ConversationViewer slug={slug} />
			</Suspense>
		</div>
	);
}

function ProjectHeader({ slug }: { slug: string }) {
	const { data: project } = useSuspenseQuery(projectQueryOptions(slug));

	if (!project) {
		return (
			<Card>
				<CardContent className="py-8 text-center text-muted-foreground">
					Project not found.
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between space-y-0">
				<div>
					<CardTitle className="text-xl text-foreground">{project.name}</CardTitle>
					<div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
						<div className="flex items-center gap-1">
							<Calendar className="h-3.5 w-3.5" />
							{formatDate(project.createdAt)}
						</div>
						<span className="font-mono text-xs">{project.slug}</span>
					</div>
				</div>
				<Badge variant={STATUS_BADGE_VARIANT[project.status] ?? "secondary"}>
					{project.status}
				</Badge>
			</CardHeader>
		</Card>
	);
}

function ConversationViewer({ slug }: { slug: string }) {
	const { data } = useSuspenseQuery(messagesQueryOptions(slug));

	if (data.data.length === 0) {
		return (
			<Card>
				<CardContent className="flex flex-col items-center justify-center py-12 text-center">
					<MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
					<h3 className="text-lg font-semibold text-foreground">No messages yet</h3>
					<p className="text-muted-foreground mt-1">
						The conversation will appear here once the client starts.
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base text-foreground">Conversation</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				{data.data.map((message: Message) => (
					<MessageBubble key={message.id} message={message} />
				))}
			</CardContent>
		</Card>
	);
}

function MessageBubble({ message }: { message: Message }) {
	const isUser = message.role === "user";
	const isSystem = message.role === "system";

	return (
		<div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
			<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
				{isUser ? (
					<User className="h-4 w-4 text-muted-foreground" />
				) : (
					<Bot className="h-4 w-4 text-muted-foreground" />
				)}
			</div>
			<div
				className={`flex-1 space-y-1 ${isUser ? "text-right" : ""} ${isSystem ? "opacity-60" : ""}`}
			>
				<div className="flex items-center gap-2 text-xs text-muted-foreground">
					<span className="font-medium capitalize">{message.role}</span>
					{message.phase && (
						<Badge variant="outline" className="text-xs">
							{message.phase}
						</Badge>
					)}
					<span>{formatTime(message.createdAt)}</span>
				</div>
				<div
					className={`inline-block rounded-lg px-4 py-2 text-sm ${
						isUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
					}`}
				>
					{message.content}
				</div>
			</div>
		</div>
	);
}

function ProjectDetailSkeleton() {
	return (
		<div className="space-y-4">
			<Card>
				<CardHeader>
					<div className="h-6 w-48 animate-pulse rounded bg-muted" />
					<div className="h-4 w-32 animate-pulse rounded bg-muted mt-2" />
				</CardHeader>
			</Card>
			<Card>
				<CardContent className="py-8">
					<div className="space-y-4">
						{Array.from({ length: 3 }, (_, i) => (
							<div key={`msg-skeleton-${i}`} className="flex gap-3">
								<div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
								<div className="flex-1 space-y-2">
									<div className="h-3 w-20 animate-pulse rounded bg-muted" />
									<div className="h-10 w-3/4 animate-pulse rounded bg-muted" />
								</div>
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
