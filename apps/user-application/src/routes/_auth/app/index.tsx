import type { Project } from "@repo/data-ops/project";
import { useForm } from "@tanstack/react-form";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Calendar, ExternalLink, MessageSquare, Plus } from "lucide-react";
import { Suspense, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createProjectApi, fetchProjects } from "@/lib/project-api-client";

const projectsQueryOptions = queryOptions({
	queryKey: ["projects", { limit: 100, offset: 0 }],
	queryFn: () => fetchProjects({ limit: 100, offset: 0 }),
});

export const Route = createFileRoute("/_auth/app/")({
	loader: ({ context }) => context.queryClient.ensureQueryData(projectsQueryOptions),
	component: ProjectDashboard,
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

function ProjectDashboard() {
	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight text-foreground">Projects</h1>
					<p className="text-muted-foreground">Manage client projects and conversations</p>
				</div>
				<CreateProjectDialog />
			</div>

			<Suspense fallback={<ProjectListSkeleton />}>
				<ProjectList />
			</Suspense>
		</div>
	);
}

function ProjectList() {
	const { data } = useSuspenseQuery(projectsQueryOptions);
	const navigate = useNavigate();

	if (data.data.length === 0) {
		return (
			<Card>
				<CardContent className="flex flex-col items-center justify-center py-12 text-center">
					<MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
					<h3 className="text-lg font-semibold text-foreground">No projects yet</h3>
					<p className="text-muted-foreground mt-1">Create your first project to get started.</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{data.data.map((project: Project) => (
				<Card
					key={project.id}
					className="cursor-pointer transition-colors hover:bg-accent/50"
					onClick={() => navigate({ to: "/app/projects/$slug", params: { slug: project.slug } })}
				>
					<CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
						<CardTitle className="text-base font-semibold text-foreground">
							{project.name}
						</CardTitle>
						<Badge variant={STATUS_BADGE_VARIANT[project.status] ?? "secondary"}>
							{project.status}
						</Badge>
					</CardHeader>
					<CardContent>
						<div className="flex items-center gap-4 text-sm text-muted-foreground">
							<div className="flex items-center gap-1">
								<Calendar className="h-3.5 w-3.5" />
								{formatDate(project.createdAt)}
							</div>
							<div className="flex items-center gap-1">
								<ExternalLink className="h-3.5 w-3.5" />
								<span className="font-mono text-xs">{project.slug}</span>
							</div>
						</div>
					</CardContent>
				</Card>
			))}
		</div>
	);
}

function ProjectListSkeleton() {
	return (
		<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{Array.from({ length: 3 }, (_, i) => (
				<Card key={`skeleton-${i}`}>
					<CardHeader>
						<div className="h-5 w-32 animate-pulse rounded bg-muted" />
					</CardHeader>
					<CardContent>
						<div className="h-4 w-48 animate-pulse rounded bg-muted" />
					</CardContent>
				</Card>
			))}
		</div>
	);
}

function CreateProjectDialog() {
	const [open, setOpen] = useState(false);
	const [createdProject, setCreatedProject] = useState<Project | null>(null);
	const queryClient = useQueryClient();

	const mutation = useMutation({
		mutationFn: createProjectApi,
		onSuccess: (project) => {
			setCreatedProject(project);
			queryClient.invalidateQueries({ queryKey: ["projects"] });
		},
	});

	const form = useForm({
		defaultValues: { name: "" },
		onSubmit: async ({ value }) => {
			mutation.reset();
			mutation.mutate(value);
		},
	});

	const handleOpenChange = (nextOpen: boolean) => {
		setOpen(nextOpen);
		if (!nextOpen) {
			setCreatedProject(null);
			mutation.reset();
			form.reset();
		}
	};

	const clientLink = createdProject ? `${window.location.origin}/${createdProject.slug}` : "";

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>
				<Button>
					<Plus className="h-4 w-4 mr-2" />
					New Project
				</Button>
			</DialogTrigger>
			<DialogContent>
				{createdProject ? (
					<>
						<DialogHeader>
							<DialogTitle>Project Created</DialogTitle>
							<DialogDescription>
								Share this link with your client to start the conversation.
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-3">
							<div>
								<label className="text-sm font-medium text-foreground">Project Name</label>
								<p className="text-sm text-muted-foreground">{createdProject.name}</p>
							</div>
							<div>
								<label className="text-sm font-medium text-foreground">Client Link</label>
								<div className="flex items-center gap-2 mt-1">
									<Input readOnly value={clientLink} className="font-mono text-xs" />
									<Button
										variant="outline"
										size="icon"
										onClick={() => navigator.clipboard.writeText(clientLink)}
									>
										<ExternalLink className="h-4 w-4" />
									</Button>
								</div>
							</div>
						</div>
						<DialogFooter>
							<Button onClick={() => handleOpenChange(false)}>Done</Button>
						</DialogFooter>
					</>
				) : (
					<form
						onSubmit={(e) => {
							e.preventDefault();
							form.handleSubmit();
						}}
					>
						<DialogHeader>
							<DialogTitle>Create Project</DialogTitle>
							<DialogDescription>Enter a name for the new client project.</DialogDescription>
						</DialogHeader>
						<div className="py-4">
							{mutation.isError && (
								<Alert variant="destructive" className="mb-4">
									{mutation.error.message}
								</Alert>
							)}
							<form.Field
								name="name"
								validators={{
									onChange: ({ value }) => (!value ? "Project name is required" : undefined),
								}}
							>
								{(field) => (
									<div className="space-y-2">
										<label htmlFor="project-name" className="text-sm font-medium text-foreground">
											Project Name
										</label>
										<Input
											id="project-name"
											placeholder="e.g. Acme Corp Audit"
											value={field.state.value}
											onChange={(e) => field.handleChange(e.target.value)}
											onBlur={field.handleBlur}
										/>
										{field.state.meta.errors.length > 0 && (
											<p className="text-sm text-destructive">{field.state.meta.errors[0]}</p>
										)}
									</div>
								)}
							</form.Field>
						</div>
						<DialogFooter>
							<form.Subscribe selector={(s) => s.canSubmit}>
								{(canSubmit) => (
									<Button type="submit" disabled={!canSubmit || mutation.isPending}>
										{mutation.isPending ? "Creating..." : "Create Project"}
									</Button>
								)}
							</form.Subscribe>
						</DialogFooter>
					</form>
				)}
			</DialogContent>
		</Dialog>
	);
}
