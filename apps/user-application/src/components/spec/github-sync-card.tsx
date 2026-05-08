import type { Project, Task } from "@repo/data-ops/project";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Github } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	listAvailableRepos,
	pushTasksToGithub,
	setProjectGithubRepo,
} from "@/lib/github-api-client";

interface GithubSyncCardProps {
	project: Project;
	tasks: Task[];
}

export function GithubSyncCard({ project, tasks }: GithubSyncCardProps) {
	const queryClient = useQueryClient();

	const reposQuery = useQuery({
		queryKey: ["github", "repos"],
		queryFn: () => listAvailableRepos(),
		staleTime: 60_000,
	});

	const setRepoMutation = useMutation({
		mutationFn: (repo: string) => setProjectGithubRepo(project.slug, repo),
		onSuccess: (updated) => {
			queryClient.setQueryData(["projects", project.slug], updated);
		},
	});

	const pushMutation = useMutation({
		mutationFn: () => pushTasksToGithub(project.slug),
		onSuccess: (refreshedTasks) => {
			queryClient.setQueryData(["projects", project.slug, "tasks"], refreshedTasks);
		},
	});

	const allLinked = tasks.length > 0 && tasks.every((t) => t.githubIssueNumber !== null);
	const pushDisabled =
		!project.githubRepo || tasks.length === 0 || allLinked || pushMutation.isPending;

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-base text-foreground">
					<Github className="h-4 w-4" />
					GitHub sync
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="space-y-2">
					<label htmlFor="github-repo-select" className="text-sm font-medium text-foreground">
						Repository
					</label>
					{reposQuery.isLoading ? (
						<div className="h-9 w-full animate-pulse rounded bg-muted" />
					) : reposQuery.isError ? (
						<Alert variant="destructive">
							<AlertDescription>{reposQuery.error.message}</AlertDescription>
						</Alert>
					) : (
						<select
							id="github-repo-select"
							value={project.githubRepo ?? ""}
							onChange={(e) => {
								const value = e.target.value;
								if (value) setRepoMutation.mutate(value);
							}}
							disabled={setRepoMutation.isPending}
							className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
						>
							<option value="" disabled>
								Select a repository…
							</option>
							{reposQuery.data?.map((repo) => (
								<option key={repo.fullName} value={repo.fullName}>
									{repo.fullName}
									{repo.private ? " (private)" : ""}
								</option>
							))}
						</select>
					)}
					{setRepoMutation.isError && (
						<Alert variant="destructive">
							<AlertDescription>{setRepoMutation.error.message}</AlertDescription>
						</Alert>
					)}
				</div>

				<div className="space-y-2">
					<Button
						type="button"
						onClick={() => pushMutation.mutate()}
						disabled={pushDisabled}
						className="w-full"
					>
						{pushMutation.isPending ? "Pushing…" : "Push to GitHub"}
					</Button>
					{!project.githubRepo && (
						<p className="text-xs text-muted-foreground">Select a repository first.</p>
					)}
					{project.githubRepo && tasks.length === 0 && (
						<p className="text-xs text-muted-foreground">No tasks to push yet.</p>
					)}
					{project.githubRepo && allLinked && (
						<p className="text-xs text-muted-foreground">All tasks are already linked.</p>
					)}
					{pushMutation.isError && (
						<Alert variant="destructive">
							<AlertDescription>{pushMutation.error.message}</AlertDescription>
						</Alert>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
