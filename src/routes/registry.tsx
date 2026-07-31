import { cache } from "@solidjs/router";
import { createSignal, createResource, Show, onMount } from "solid-js";
import SiteLayout from "~/components/SiteLayout";
import { SearchTree } from "~/components/SearchTree";
import { ExtensionPanel } from "~/components/ExtensionPanel";
import { searchExtensions } from "~/lib/registry/search";
import { resolveDependencyTree } from "~/lib/registry/analyzer";

const searchAction = cache(async (query: string) => {
    "use server";
    if (query.length < 2) return [];
    return await searchExtensions(query);
}, "registry-search");

const resolveDepsAction = cache(async (id: string) => {
    "use server";
    return await resolveDependencyTree(id, 1);
}, "registry-deps");

export default function Registry() {
    const [query, setQuery] = createSignal("");
    const [selectedId, setSelectedId] = createSignal<string | null>(null);
    const [isDark, setIsDark] = createSignal(true);

    onMount(() => {
        // Simple theme initialization
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            setIsDark(true);
            document.documentElement.classList.add('dark');
        } else {
            setIsDark(false);
            document.documentElement.classList.remove('dark');
        }
    });

    const toggleTheme = () => {
        const next = !isDark();
        setIsDark(next);
        if (next) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    };

    const [results] = createResource(query, async (q) => {
        return await searchAction(q);
    });

    const [depTree] = createResource(selectedId, async (id) => {
        if (!id) return null;
        return await resolveDepsAction(id);
    });

    const selectedExtension = () => {
        const id = selectedId();
        if (!id) return null;
        return results()?.find(r => r.id === id) || results()?.flatMap(r => r.children).find(r => r.id === id) || null;
    };

    return (
        <SiteLayout>
        <div class="min-h-screen bg-background p-8 pb-32 transition-colors duration-300">
            <div class="max-w-5xl mx-auto space-y-12 mt-12">
                <nav class="flex justify-end">
                    <button
                        onClick={toggleTheme}
                        class="p-3 rounded-2xl glass border border-border text-muted-foreground hover:text-foreground transition-all"
                        title="Toggle Theme"
                    >
                        <Show when={isDark()} fallback={
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                        }>
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M16.243 16.243l.707.707M7.757 7.757l.707-.707" /></svg>
                        </Show>
                    </button>
                </nav>

                <header class="text-center space-y-6">
                    <div class="inline-block px-4 py-1.5 rounded-full glass border border-indigo-500/20 text-[10px] font-bold tracking-[0.3em] text-indigo-500 dark:text-indigo-400 uppercase">
                        Official Registry
                    </div>
                    <h1 class="text-6xl md:text-7xl font-black tracking-tighter text-foreground leading-tight font-outfit">
                        ANTORA <span class="bg-clip-text text-transparent premium-gradient">EXTENSIONS</span>
                    </h1>
                    <p class="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
                        The central hub for Antora extensions and bundles. Discover, analyze, and integrate with confidence.
                    </p>
                </header>

                <section class="max-w-2xl mx-auto">
                    <div class="relative group">
                        <div class="absolute -inset-1 premium-gradient rounded-2xl blur opacity-25 group-focus-within:opacity-50 transition duration-1000" />
                        <input
                            type="text"
                            placeholder="Search extensions, bundles, or keywords..."
                            class="relative w-full px-8 py-5 bg-card rounded-2xl border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-xl font-medium shadow-2xl shadow-indigo-500/5"
                            onInput={(e) => setQuery(e.currentTarget.value)}
                        />
                        <div class="absolute right-6 top-1/2 -translate-y-1/2 text-muted-foreground">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                    </div>
                </section>

                <section class="mx-auto">
                    <Show when={results() && results()!.length > 0} fallback={
                        <div class="flex flex-col items-center justify-center py-32 text-center space-y-4">
                            <div class="p-6 rounded-full glass border border-border text-muted-foreground/20">
                                <svg class="w-16 h-16" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" /></svg>
                            </div>
                            <div class="text-muted-foreground italic font-medium">
                                {query().length < 2 ? 'Start typing to explore the registry...' : 'No extensions found matching your search.'}
                            </div>
                        </div>
                    }>
                        <div class="grid gap-4">
                            <SearchTree results={results()!} onSelect={setSelectedId} />
                        </div>
                    </Show>
                </section>
            </div>

            <ExtensionPanel
                extension={selectedExtension()}
                isOpen={selectedId() !== null}
                onClose={() => setSelectedId(null)}
                dependencyTree={depTree()}
                onAnalyzeFull={() => {/* Full analysis logic */ }}
            />
        </div>
        </SiteLayout>
    );
}
