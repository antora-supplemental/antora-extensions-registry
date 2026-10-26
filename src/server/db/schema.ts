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
    reviewNote: text("reviewNote"),
    reviewedBy: text("reviewedBy"),
    reviewedAt: integer("reviewedAt", { mode: "timestamp" }),
    approvedVia: text("approvedVia"),
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
    reviewNote: text("reviewNote"),
    reviewedBy: text("reviewedBy"),
    reviewedAt: integer("reviewedAt", { mode: "timestamp" }),
    approvedVia: text("approvedVia"),
    appearance: text("appearance", { enum: ["light", "dark", "both", "other"] }),
    baseTheme: text("baseTheme"),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

/** One row per catalog module/recipe/extension, written by scripts/sync-catalog-db.ts. */
export const catalogEntries = sqliteTable("catalog_entry", {
    catalogId: text("catalogId").primaryKey(),
    repoOwner: text("repoOwner").notNull(),
    repoName: text("repoName").notNull(),
    type: text("type").notNull(),
    name: text("name").notNull(),
    version: text("version").notNull(),
    payload: text("payload").notNull(), // JSON ExtensionCatalogEntry
    syncedAt: integer("syncedAt", { mode: "timestamp" }).notNull(),
});

/**
 * One row per tagged release of a cataloged repository, with the Antora line(s) it targets
 * (precedence in src/lib/antora-compat.ts). Written by scripts/sync-catalog-db.ts; created by drizzle-kit push.
 */
export const catalogReleases = sqliteTable("catalog_release", {
    repo: text("repo").notNull(), // owner/repo, lowercase
    tag: text("tag").notNull(),
    version: text("version").notNull(),
    rolling: integer("rolling", { mode: "boolean" }).notNull(),
    prerelease: integer("prerelease", { mode: "boolean" }).notNull(),
    antora: text("antora").notNull(), // JSON number[]; [] = undeclared
    antoraSource: text("antoraSource"), // build-metadata | engines | peer-dependencies | repo-default
    publishedAt: text("publishedAt"),
    installSpec: text("installSpec").notNull(),
    assets: text("assets").notNull(), // JSON {name,url}[]
    syncedAt: integer("syncedAt", { mode: "timestamp" }).notNull(),
}, (table) => ({
    pk: primaryKey({ columns: [table.repo, table.tag] }),
}));

/** Package-to-package compatibility computed at sync (src/lib/pkg-compat.ts); also stored in each payload. */
export const catalogCompat = sqliteTable("catalog_compat", {
    source: text("source").notNull(), // catalogId
    target: text("target").notNull(), // catalogId, or declared package name when not indexed
    relation: text("relation").notNull(), // works-with | conflicts | alternative | antora-mismatch
    confidence: text("confidence").notNull(), // declared | curated | guaranteed | likely
    why: text("why").notNull(),
    path: text("path"), // JSON string[] chain
    contracts: text("contracts"), // JSON string[]
    syncedAt: integer("syncedAt", { mode: "timestamp" }).notNull(),
}, (table) => ({
    pk: primaryKey({ columns: [table.source, table.target] }),
}));

/** Sync bookkeeping (last run, counts). */
export const catalogMeta = sqliteTable("catalog_meta", {
    key: text("key").primaryKey(),
    value: text("value").notNull(),
});


/** One row per self-service account merge (source user B folded into target user A). */
export const accountMergeAudit = sqliteTable("account_merge_audit", {
    id: text("id").primaryKey(),
    targetUserId: text("targetUserId").notNull(),
    sourceUserId: text("sourceUserId").notNull(),
    sourceEmail: text("sourceEmail"),
    movedProviders: text("movedProviders").notNull(), // JSON string[]
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
});

/** Expedited repository checks from /add: rate limiting and an audit trail. */
export const repoChecks = sqliteTable("repo_check", {
    id: text("id").primaryKey(),
    userId: text("userId").notNull(),
    repoUrl: text("repoUrl").notNull(),
    kind: text("kind"),
    passed: integer("passed", { mode: "boolean" }).notNull(),
    imported: integer("imported", { mode: "boolean" }).notNull(),
    failures: text("failures").notNull().default("[]"),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

/** Owners and accounts whose submissions skip the review queue. */
export const trustedPublishers = sqliteTable("trusted_publisher", {
    id: text("id").primaryKey(),
    kind: text("kind", { enum: ["github_user", "github_org", "gitlab_user", "gitlab_group"] }).notNull(),
    name: text("name").notNull(),
    addedBy: text("addedBy"),
    note: text("note"),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

/** User reports about a listed extension or theme. */
export const reports = sqliteTable("report", {
    id: text("id").primaryKey(),
    itemKind: text("itemKind", { enum: ["extension", "theme"] }).notNull(),
    itemId: text("itemId").notNull(),
    itemName: text("itemName").notNull(),
    reporterId: text("reporterId").notNull(),
    reason: text("reason", { enum: ["low-quality", "broken", "security", "spam", "license", "other"] }).notNull(),
    message: text("message"),
    status: text("status", { enum: ["open", "resolved", "dismissed"] }).notNull().default("open"),
    resolvedBy: text("resolvedBy"),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

/**
 * When an extension or theme was first listed. Written with INSERT OR IGNORE so the
 * timestamp never changes on re-import, sync or update. Drives the "New" badge.
 */
export const firstListed = sqliteTable("first_listed", {
    id: text("id").primaryKey(), // `${kind}:${itemId}`
    kind: text("kind", { enum: ["extension", "theme"] }).notNull(),
    itemId: text("itemId").notNull(),
    firstListedAt: integer("firstListedAt", { mode: "timestamp" }).notNull(),
});

/**
 * Admin overrides for sync-time metadata. NULL columns mean "keep what the sync found".
 * Applied on read (lib/catalog-db.ts), so a daily sync never undoes them.
 */
export const catalogOverrides = sqliteTable("catalog_override", {
    catalogId: text("catalogId").primaryKey(),
    layers: text("layers"), // JSON LayerId[]; "[]" = explicitly unclassified
    bundleMembers: text("bundleMembers"), // JSON string[]; "[]" = explicitly not a bundle
    updatedBy: text("updatedBy"),
    updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

/** Preview images added in /admin (by URL). Shown before manifest and README images. */
export const catalogPreviews = sqliteTable("catalog_preview", {
    id: text("id").primaryKey(),
    catalogId: text("catalogId").notNull(),
    url: text("url").notNull(),
    caption: text("caption"),
    position: integer("position").notNull().default(0),
    addedBy: text("addedBy"),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});
