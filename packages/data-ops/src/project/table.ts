import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const projects = pgTable("projects", {
	id: uuid("id").defaultRandom().primaryKey(),
	name: text("name").notNull(),
	slug: text("slug").notNull().unique(),
	status: text("status", { enum: ["interviewing", "review", "active", "complete"] })
		.notNull()
		.default("interviewing"),
	githubRepo: text("github_repo"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const messages = pgTable("messages", {
	id: uuid("id").defaultRandom().primaryKey(),
	projectId: uuid("project_id")
		.notNull()
		.references(() => projects.id, { onDelete: "cascade" }),
	role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
	content: text("content").notNull(),
	phase: text("phase"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const specs = pgTable("specs", {
	id: uuid("id").defaultRandom().primaryKey(),
	projectId: uuid("project_id")
		.notNull()
		.references(() => projects.id, { onDelete: "cascade" }),
	contentMarkdown: text("content_markdown").notNull(),
	version: integer("version").notNull().default(1),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tasks = pgTable("tasks", {
	id: uuid("id").defaultRandom().primaryKey(),
	projectId: uuid("project_id")
		.notNull()
		.references(() => projects.id, { onDelete: "cascade" }),
	title: text("title").notNull(),
	description: text("description"),
	status: text("status").notNull().default("pending"),
	githubIssueNumber: integer("github_issue_number"),
	githubIssueUrl: text("github_issue_url"),
	sortOrder: integer("sort_order").notNull().default(0),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});
