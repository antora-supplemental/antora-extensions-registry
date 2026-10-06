import { convert } from '@asciidoctor/core';
import matter from 'gray-matter';

export interface ExtensionDoc {
    name: string;
    description?: string;
    screenshots?: { url: string; caption?: string }[];
    contentHtml: string;
}

export async function parseExtensionDoc(content: string): Promise<ExtensionDoc> {
    // 1. Extract frontmatter
    const { data, content: adocContent } = matter(content);

    // 2. Convert AsciiDoc to HTML
    // We use 'safe' mode to prevent arbitrary file inclusion and other security risks
    // We use the 'showtitle' attribute to ensure the title is rendered if present
    const contentHtml = await convert(adocContent, {
        safe: 'secure',
        attributes: {
            showtitle: true,
            'source-highlighter': 'highlightjs',
        }
    }) as string;

    return {
        name: data.name || '',
        description: data.description,
        screenshots: data.screenshots,
        contentHtml,
    };
}
