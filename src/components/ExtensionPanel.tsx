import type { Component } from "solid-js";
import { createSignal, Show, For } from "solid-js";
import { InstallMethods } from "./InstallMethods";
import type { DependencyNode } from "~/lib/registry/analyzer";
import type { SearchResult } from "~/lib/registry/search";

export const ExtensionPanel: Component<{
    extension: SearchResult | null;
    isOpen: boolean;
    onClose: () => void;
    dependencyTree: DependencyNode | null;
    onAnalyzeFull: () => void;
}> = (props) => {
    const [collapsed, setCollapsed] = createSignal({ install: false, preview: false, deps: false });

    return (
        <div class={`side-panel ${props.isOpen ? 'open' : ''} p-8 overflow-y-auto`}>
            <div class="flex items-center justify-between mb-10">
                <button onClick={props.onClose} class="p-2.5 rounded-full hover:bg-foreground/10 text-muted-foreground transition-all hover:text-foreground ring-1 ring-border">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                <div class="text-[10px] text-muted-foreground font-mono uppercase tracking-[0.3em] font-bold">Extension Insight</div>
            </div>

            <Show when={props.extension}>
                <div class="space-y-10 animate-in">
                    <header>
                        <h2 class="text-3xl font-bold text-foreground mb-3 tracking-tight font-outfit">{props.extension.name}</h2>
                        <div class="flex items-center gap-3 mb-4">
                            <span class="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 dark:text-indigo-300 font-medium border border-indigo-500/10">v{props.extension.version}</span>
                            <span class="text-xs text-muted-foreground">{props.extension.type === 'bundle' ? 'Extension Bundle' : 'Individual Extension'}</span>
                        </div>
                        <p class="text-muted-foreground leading-relaxed italic">{props.extension.description}</p>
                    </header>

                    <section>
                        <CollapsibleHeader title="Integration" isOpen={!collapsed().install} onToggle={() => setCollapsed({ ...collapsed(), install: !collapsed().install })} />
                        <Show when={!collapsed().install}>
                            <div class="mt-6">
                                <InstallMethods name={props.extension.name} version={props.extension.version} />
                            </div>
                        </Show>
                    </section>

                    <section>
                        <CollapsibleHeader title="Dependencies" isOpen={!collapsed().deps} onToggle={() => setCollapsed({ ...collapsed(), deps: !collapsed().deps })} />
                        <Show when={!collapsed().deps}>
                            <div class="mt-6 space-y-6">
                                <Show when={props.dependencyTree} fallback={<div class="text-sm text-yellow-500/70 py-4 px-4 rounded-lg bg-yellow-500/5 border border-yellow-500/10 italic">Indexing dependency graph...</div>}>
                                    <div class="space-y-3">
                                        <For each={props.dependencyTree?.dependencies}>
                                            {(dep) => (
                                                <div class="flex items-center justify-between p-4 rounded-xl glass border border-border group hover:bg-foreground/5 transition-all">
                                                    <div class="flex flex-col">
                                                        <span class="text-sm font-medium text-foreground transition-colors">{dep.name}</span>
                                                        <span class="text-[10px] text-muted-foreground">{dep.isExternal ? 'NPM Package' : 'Registry Native'}</span>
                                                    </div>
                                                    <span class="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground font-mono">{dep.version || '*'}</span>
                                                </div>
                                            )}
                                        </For>
                                        <Show when={props.dependencyTree?.dependencies.length === 0}>
                                            <div class="text-sm text-muted-foreground py-4 text-center glass rounded-xl border border-dashed border-border">No dependencies detected</div>
                                        </Show>
                                    </div>
                                    <button
                                        onClick={props.onAnalyzeFull}
                                        class="w-full py-3 text-[11px] font-bold tracking-widest rounded-xl premium-gradient text-white shadow-lg shadow-indigo-500/20 hover:scale-[1.02] transition-transform active:scale-95"
                                    >
                                        ANALYZE FULL TREE
                                    </button>
                                </Show>
                            </div>
                        </Show>
                    </section>

                    <Show when={props.extension.readme}>
                        <section>
                            <CollapsibleHeader title="Documentation" isOpen={!collapsed().preview} onToggle={() => setCollapsed({ ...collapsed(), preview: !collapsed().preview })} />
                            <Show when={!collapsed().preview}>
                                <div class="mt-6 prose dark:prose-invert prose-sm max-w-none glass p-6 rounded-2xl border border-border adoc-content" innerHTML={props.extension.readme} />
                            </Show>
                        </section>
                    </Show>
                </div>
            </Show>
        </div>
    );
};

const CollapsibleHeader: Component<{ title: string; isOpen: boolean; onToggle: () => void }> = (props) => (
    <div
        class="flex items-center justify-between py-3 border-b border-border cursor-pointer group"
        onClick={props.onToggle}
    >
        <h3 class="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground group-hover:text-foreground transition-colors">
            {props.title}
        </h3>
        <svg class={`w-4 h-4 text-muted-foreground transition-transform duration-300 ${props.isOpen ? 'rotate-180 text-foreground' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
        </svg>
    </div>
);
