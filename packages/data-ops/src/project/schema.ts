import { z } from "zod";

// ============================================
// Domain Models (database entities)
// ============================================

export const PROJECT_STATUS = ["interviewing", "review", "active", "complete"] as const;
export const MESSAGE_ROLE = ["user", "assistant", "system"] as const;

export const ProjectSchema = z.object({
	id: z.string().uuid(),
	name: z.string(),
	slug: z.string(),
	status: z.enum(PROJECT_STATUS),
	githubRepo: z.string().nullable(),
	createdAt: z.coerce.date(),
});

export const MessageSchema = z.object({
	id: z.string().uuid(),
	projectId: z.string().uuid(),
	role: z.enum(MESSAGE_ROLE),
	content: z.string(),
	phase: z.string().nullable(),
	createdAt: z.coerce.date(),
});

export const SpecSchema = z.object({
	id: z.string().uuid(),
	projectId: z.string().uuid(),
	contentMarkdown: z.string(),
	version: z.number().int(),
	createdAt: z.coerce.date(),
});

export const CONVERSATION_PHASE = ["discovery", "requirements", "plan", "tasks"] as const;

export const SystemPromptSchema = z.object({
	id: z.string().uuid(),
	phase: z.string(),
	content: z.string(),
	updatedAt: z.coerce.date(),
});

export const TaskSchema = z.object({
	id: z.string().uuid(),
	projectId: z.string().uuid(),
	title: z.string(),
	description: z.string().nullable(),
	status: z.string(),
	githubIssueNumber: z.number().int().nullable(),
	githubIssueUrl: z.string().nullable(),
	sortOrder: z.number().int(),
	createdAt: z.coerce.date(),
});

// ============================================
// Request Schemas
// ============================================

export const ProjectCreateRequestSchema = z.object({
	name: z.string().min(1, "Name is required").max(100, "Name must be at most 100 characters"),
});

export const SlugParamSchema = z.object({
	slug: z
		.string()
		.min(1, "Slug is required")
		.regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
});

// ============================================
// Response Schemas
// ============================================

export const ProjectListResponseSchema = z.object({
	data: z.array(ProjectSchema),
	pagination: z.object({
		total: z.number(),
		limit: z.number(),
		offset: z.number(),
		hasMore: z.boolean(),
	}),
});

export const MessageCreateRequestSchema = z.object({
	content: z.string().min(1, "Content is required"),
});

export const MessageListResponseSchema = z.object({
	data: z.array(MessageSchema),
});

// ============================================
// Types
// ============================================

export type Project = z.infer<typeof ProjectSchema>;
export type Message = z.infer<typeof MessageSchema>;
export type Spec = z.infer<typeof SpecSchema>;
export type SystemPrompt = z.infer<typeof SystemPromptSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type ProjectCreateInput = z.infer<typeof ProjectCreateRequestSchema>;
export type MessageCreateInput = z.infer<typeof MessageCreateRequestSchema>;
export type ProjectListResponse = z.infer<typeof ProjectListResponseSchema>;
export type MessageListResponse = z.infer<typeof MessageListResponseSchema>;
