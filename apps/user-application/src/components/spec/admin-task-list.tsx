import type { Task } from "@repo/data-ops/project";
import { CheckCircle2, Circle, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AdminTaskListProps {
	tasks: Task[];
}

const DONE_STATUSES = new Set(["completed", "done", "closed"]);

function isTaskDone(status: string): boolean {
	return DONE_STATUSES.has(status.toLowerCase());
}

export function AdminTaskList({ tasks }: AdminTaskListProps) {
	if (tasks.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-base text-foreground">Tasks</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-muted-foreground text-sm">No tasks yet.</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base text-foreground">Tasks ({tasks.length})</CardTitle>
			</CardHeader>
			<CardContent>
				<ul className="space-y-2">
					{tasks.map((task) => {
						const done = isTaskDone(task.status);
						return (
							<li key={task.id} className="flex items-start gap-3 rounded-lg border bg-card p-3">
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
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2">
										<p
											className={
												done
													? "text-foreground line-through decoration-muted-foreground"
													: "text-foreground"
											}
										>
											{task.title}
										</p>
										{task.githubIssueNumber !== null && task.githubIssueUrl !== null && (
											<a
												href={task.githubIssueUrl}
												target="_blank"
												rel="noopener noreferrer"
												aria-label={`GitHub issue #${task.githubIssueNumber}`}
												className="text-muted-foreground hover:text-foreground"
											>
												<ExternalLink className="h-3.5 w-3.5" />
											</a>
										)}
									</div>
									{task.description && (
										<p className="text-xs text-muted-foreground mt-1">{task.description}</p>
									)}
								</div>
								<Badge variant="outline" className="text-xs">
									{task.status}
								</Badge>
							</li>
						);
					})}
				</ul>
			</CardContent>
		</Card>
	);
}
