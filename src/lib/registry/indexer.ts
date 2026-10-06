import { db } from "~/server/db";
import { extensions, dependencies, bundleMembers, screenshots } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

interface PackageJson {
    name: string;
    version: string;
    description?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    keywords?: string[];
    antora?: {
        extensions?: string[];
    };
}

export interface ScreenshotMetadata {
    url: string;
    caption?: string;
}

export interface EnhancedMetadata {
    readme?: string;
    screenshots?: ScreenshotMetadata[];
}

const NATIVE_ANTORA_PACKAGES = [
    "@antora/cli",
    "@antora/site-generator",
    "@antora/asciidoc-loader",
    "@antora/content-aggregator",
    "@antora/content-classifier",
    "@antora/document-converter",
    "@antora/navigation-builder",
    "@antora/page-composer",
    "@antora/redirect-producer",
    "@antora/site-mapper",
    "@antora/site-publisher",
    "@antora/ui-loader",
];

import { parseExtensionDoc } from "./parser";

export async function indexExtension(
    pkg: PackageJson,
    type: "extension" | "bundle" = "extension",
    authorId?: string,
    repositoryUrl?: string,
    enhanced?: EnhancedMetadata
) {
    let readmeHtml = enhanced?.readme;
    
    // If we have an adoc file, it should be parsed
    // This is where we dogfood the AsciiDoc parser
    if (enhanced?.readme && (enhanced.readme.includes('\n= ') || enhanced.readme.startsWith('= '))) {
        const parsed = await parseExtensionDoc(enhanced.readme);
        readmeHtml = parsed.contentHtml;
        // Optionally update other metadata from frontmatter if not provided
        if (!pkg.description) pkg.description = parsed.description;
    }

    // 1. Check for existing record to maintain ID stability
    const [existing] = await db.select().from(extensions).where(eq(extensions.name, pkg.name));
    const targetId = existing?.id || uuidv4();

    // 2. Insert or Update Extension
    await db.insert(extensions).values({
        id: targetId,
        name: pkg.name,
        version: pkg.version,
        description: pkg.description,
        type,
        authorId,
        repositoryUrl,
        npmName: pkg.name,
        readme: readmeHtml,
        createdAt: new Date(),
        updatedAt: new Date(),
    }).onConflictDoUpdate({
        target: extensions.name,
        set: {
            version: pkg.version,
            description: pkg.description,
            readme: readmeHtml,
            repositoryUrl: repositoryUrl ? repositoryUrl : undefined,
            updatedAt: new Date(),
        },
    });

    // 3. Clear old sub-data (dependencies and screenshots)
    if (existing) {
        await db.delete(dependencies).where(eq(dependencies.sourceId, existing.id));
        await db.delete(screenshots).where(eq(screenshots.extensionId, existing.id));
    }

    // 4. Analyze and insert dependencies
    const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
        ...pkg.peerDependencies,
    };

    const depRecords = Object.entries(allDeps)
        .filter(([name]) => !NATIVE_ANTORA_PACKAGES.includes(name))
        .map(([name, range]) => ({
            id: uuidv4(),
            sourceId: targetId,
            targetName: name,
            versionRange: range,
            isNative: false,
        }));

    if (depRecords.length > 0) {
        await db.insert(dependencies).values(depRecords);
    }

    // 5. Insert new screenshots
    if (enhanced?.screenshots && enhanced.screenshots.length > 0) {
        const screenshotRecords = enhanced.screenshots.map((s, index) => ({
            id: uuidv4(),
            extensionId: targetId,
            url: s.url,
            caption: s.caption,
            order: index,
        }));
        await db.insert(screenshots).values(screenshotRecords);
    }

    return targetId;
}

export async function indexBundle(pkg: PackageJson, memberPkgs: PackageJson[], authorId?: string) {
    const bundleId = await indexExtension(pkg, "bundle", authorId);

    for (const member of memberPkgs) {
        const extensionId = await indexExtension(member, "extension", authorId);

        await db.insert(bundleMembers).values({
            bundleId,
            extensionId,
        }).onConflictDoNothing();
    }

    return bundleId;
}
