import type { Component } from "solid-js";
import { createSignal, For } from "solid-js";

export const InstallMethods: Component<{ name: string; version: string }> = (props) => {
    const [activeTab, setActiveTab] = createSignal("pnpm");

    const methods = () => [
        { id: "npm", label: "npm", cmd: `npm install ${props.name}` },
        { id: "pnpm", label: "pnpm", cmd: `pnpm add ${props.name}` },
        { id: "yarn", label: "yarn", cmd: `yarn add ${props.name}` },
        { id: "bun", label: "bun", cmd: `bun add ${props.name}` },
    ];

    return (
        <div class="space-y-4">
            <div class="flex gap-2 p-1 rounded-lg bg-foreground/5 overflow-x-auto">
                <For each={methods()}>
                    {(m) => (
                        <button
                            onClick={() => setActiveTab(m.id)}
                            class={`flex-1 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all min-w-[60px] ${activeTab() === m.id 
                                ? 'bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 shadow-sm ring-1 ring-indigo-500/20' 
                                : 'text-muted-foreground hover:text-foreground hover:bg-foreground/5'
                                }`}
                        >
                            {m.label}
                        </button>
                    )}
                </For>
            </div>

            <div class="relative group">
                <pre class="p-4 rounded-xl glass text-[13px] font-mono overflow-x-auto text-indigo-500 dark:text-indigo-400 border border-border">
                    <code>{methods().find(m => m.id === activeTab())?.cmd}</code>
                </pre>
                <button
                    title="Copy to clipboard"
                    class="absolute top-3 right-3 p-2 rounded-md hover:bg-foreground/10 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                    onClick={() => navigator.clipboard.writeText(methods().find(m => m.id === activeTab())?.cmd || '')}
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                </button>
            </div>

            <div class="grid grid-cols-2 gap-3 mt-4">
                <button class="flex items-center justify-center gap-2 py-3 px-2 rounded-xl glass hover:bg-foreground/5 transition-all text-xs font-bold text-muted-foreground hover:text-foreground border border-border">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.041-1.416-4.041-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
                    GIT CLONE
                </button>
                <button class="flex items-center justify-center gap-2 py-3 px-2 rounded-xl glass hover:bg-foreground/5 transition-all text-xs font-bold text-muted-foreground hover:text-foreground border border-border">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    ZIP FILE
                </button>
            </div>
        </div>
    );
};
