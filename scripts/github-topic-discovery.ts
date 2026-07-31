/**
 * Read-only discovery of GitHub Topics that match Antora ecosystem naming.
 *
 * GitHub exposes a topic catalog via GET /search/topics (see response `created_at`
 * for batch-seeded names such as antora-ui-theme). Repository discovery uses
 * GET /search/repositories?q=topic:<name>.
 *
 * Usage:
 *   pnpm exec tsx scripts/github-topic-discovery.ts
 *   pnpm exec tsx scripts/github-topic-discovery.ts --repos antora-extension
 *
 * Optional env GITHUB_TOKEN raises rate limits (classic PAT: public_repo is enough).
 */

const GITHUB_API = "https://api.github.com";

/** Topics we recommend for opt-in listing; map to registry "kind" when indexing is implemented. */
export const RECOMMENDED_TOPIC_BY_KIND: Record<string, string[]> = {
  "playbook-extension": ["antora-extension"],
  bundle: ["antora-bundle"],
  "ui-theme": ["antora-ui-theme", "antora-theme", "antora-site-theme"],
  "ui-supplemental": ["antora-ui", "antora-ui-components", "antora-ui-styles", "antora-ui-kit"],
  "ui-plugin": ["antora-ui-plugin", "antoraui-plugin"],
  plugin: ["antora-plugin"],
  site: ["antora-site", "antora-docs"],
  umbrella: ["antora"],
};

function headers(): HeadersInit {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "antora-extensions-registry-topic-discovery",
  };
  if (process.env.GITHUB_TOKEN) {
    h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return h;
}

async function searchTopics(query: string) {
  const url = new URL(`${GITHUB_API}/search/topics`);
  url.searchParams.set("q", query);
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    throw new Error(`topics search failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<{
    items: Array<{ name: string; created_at: string; updated_at: string }>;
  }>;
}

async function searchRepos(topic: string, perPage = 5) {
  const q = `topic:${topic} fork:false`;
  const url = new URL(`${GITHUB_API}/search/repositories`);
  url.searchParams.set("q", q);
  url.searchParams.set("sort", "updated");
  url.searchParams.set("per_page", String(perPage));
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    throw new Error(`repo search failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<{
    total_count: number;
    items: Array<{ full_name: string; html_url: string; fork: boolean; topics?: string[] }>;
  }>;
}

async function main() {
  const args = process.argv.slice(2);
  const reposIdx = args.indexOf("--repos");
  const topicOnly = reposIdx >= 0 ? args[reposIdx + 1] : null;

  if (topicOnly) {
    const data = await searchRepos(topicOnly, 10);
    console.log(JSON.stringify({ topic: topicOnly, total_count: data.total_count, sample: data.items }, null, 2));
    return;
  }

  const catalog = await searchTopics("antora");
  console.log("=== GitHub topic catalog (q=antora) ===\n");
  for (const t of catalog.items) {
    console.log(`${t.name}\tcreated=${t.created_at}`);
  }

  console.log("\n=== Recommended mapping (local convention, not GitHub-enforced) ===\n");
  for (const [kind, topics] of Object.entries(RECOMMENDED_TOPIC_BY_KIND)) {
    console.log(`${kind}: ${topics.join(", ")}`);
  }

  console.log("\n=== Sample repo counts (fork:false) ===\n");
  const uniqueTopics = [...new Set(Object.values(RECOMMENDED_TOPIC_BY_KIND).flat())];
  for (const topic of uniqueTopics) {
    const data = await searchRepos(topic, 1);
    console.log(`${topic}\trepos≈${data.total_count}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
