import type { ClientViewResponse } from "@repo/data-ops/project";
import { CheckCircle2, Circle } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface SpecTrackingViewProps {
	view: ClientViewResponse;
}

const DONE_STATUSES = new Set(["completed", "done", "closed"]);

function isTaskDone(status: string): boolean {
	return DONE_STATUSES.has(status.toLowerCase());
}

export function SpecTrackingView({ view }: SpecTrackingViewProps) {
	const { project, spec, tasks } = view;
	const doneCount = tasks.filter((t) => isTaskDone(t.status)).length;

	return (
		<div className="min-h-screen bg-background">
			<header className="border-b">
				<div className="max-w-3xl mx-auto px-4 py-6">
					<h1 className="text-2xl font-semibold text-foreground">{project.name}</h1>
					<p className="text-sm text-muted-foreground mt-1">
						{project.status === "complete"
							? "Project complete"
							: `Implementation in progress${tasks.length > 0 ? ` — ${doneCount} of ${tasks.length} done` : ""}`}
					</p>
				</div>
			</header>

			<main className="max-w-3xl mx-auto px-4 py-8 space-y-10">
				<section aria-labelledby="spec-heading">
					<h2 id="spec-heading" className="text-lg font-semibold text-foreground mb-4">
						Project specification
					</h2>
					{spec ? (
						<article className="prose prose-neutral dark:prose-invert max-w-none text-foreground">
							<ReactMarkdown>{spec.contentMarkdown}</ReactMarkdown>
						</article>
					) : (
						<p className="text-muted-foreground">Specification is not yet available.</p>
					)}
				</section>

				<section aria-labelledby="tasks-heading">
					<h2 id="tasks-heading" className="text-lg font-semibold text-foreground mb-4">
						Progress
					</h2>
					{tasks.length === 0 ? (
						<p className="text-muted-foreground">No tasks have been added yet.</p>
					) : (
						<ul className="space-y-2">
							{tasks.map((task) => {
								const done = isTaskDone(task.status);
								return (
									<li
										key={task.id}
										className="flex items-start gap-3 rounded-lg border bg-card p-4"
									>
										{done ? (
											<CheckCircle2
												className="h-5 w-5 text-primary shrink-0 mt-0.5"
												aria-label="Done"
											/>
										) : (
											<Circle
												className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5"
												aria-label="Not done"
											/>
										)}
										<div className="flex-1">
											<p
												className={
													done
														? "text-foreground line-through decoration-muted-foreground"
														: "text-foreground"
												}
											>
												{task.title}
											</p>
											<p className="text-xs text-muted-foreground mt-1">
												{done ? "Complete" : "Not done"}
											</p>
										</div>
									</li>
								);
							})}
						</ul>
					)}
				</section>
			</main>
		</div>
	);
}
