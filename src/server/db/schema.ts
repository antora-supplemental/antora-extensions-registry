import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";

export {
  users,
  sessions,
  accounts,
  verifications,
  usersRelations,
  sessionsRelations,
  accountsRelations,
} from "./auth-schema";

import { users } from "./auth-schema";

// Extension Registry Tables
export const extensions = sqliteTable("extension", {
    id: text("id").primaryKey(),
    name: text("name").notNull().unique(), // e.g., "@antora/my-ext"
    description: text("description"),
    version: text("version").notNull(),
    type: text("type").notNull(), // "extension" | "bundle"
    authorId: text("authorId").references(() => users.id),
    repositoryUrl: text("repositoryUrl"),
    npmName: text("npmName"),
    readme: text("readme"),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const bundleMembers = sqliteTable("bundle_member", {
    bundleId: text("bundleId").notNull().references(() => extensions.id, { onDelete: "cascade" }),
    extensionId: text("extensionId").notNull().references(() => extensions.id, { onDelete: "cascade" }),
}, (table) => ({
    pk: primaryKey({ columns: [table.bundleId, table.extensionId] }),
}));

export const dependencies = sqliteTable("dependency", {
    id: text("id").primaryKey(),
    sourceId: text("sourceId").notNull().references(() => extensions.id, { onDelete: "cascade" }),
    targetName: text("targetName").notNull(),
    targetId: text("targetId").references(() => extensions.id),
    versionRange: text("versionRange"),
    isNative: integer("isNative", { mode: "boolean" }).default(false).notNull(),
});

export const screenshots = sqliteTable("screenshot", {
    id: text("id").primaryKey(),
    extensionId: text("extensionId").notNull().references(() => extensions.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    caption: text("caption"),
    order: integer("order").default(0).notNull(),
});

export const extensionRepos = sqliteTable("extension_repo", {
    id: text("id").primaryKey(),
    repoUrl: text("repoUrl").notNull().unique(),
    owner: text("owner").notNull(),
    name: text("name").notNull(),
    catalogSource: text("catalogSource"),
    moduleCount: integer("moduleCount").notNull().default(0),
    recipeCount: integer("recipeCount").notNull().default(0),
    status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
    submittedBy: text("submittedBy").references(() => users.id, { onDelete: "set null" }),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const themes = sqliteTable("theme", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    authorId: text("authorId").references(() => users.id, { onDelete: "set null" }),
    authorName: text("authorName").notNull(),
    repoUrl: text("repoUrl").notNull().unique(),
    demoUrl: text("demoUrl"),
    previewImage: text("previewImage"),
    stars: integer("stars").notNull().default(0),
    tags: text("tags").notNull().default("[]"),
    status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});
