# Durable facts for agents

- [1] Public hostname: `registry.antora-supplemental.org` (Netlify). Repo name stays `antora-extensions-registry`. Themes (`ui.bundle`) are not Antora extensions; both are categories on this site.
- [1] Production Better Auth: `BETTER_AUTH_URL=https://registry.antora-supplemental.org` and matching OAuth callbacks. DNS CNAME `registry` → Netlify site hostname (see welcome-site DOMAIN.adoc).
- [1] Standalone `antora-themes-site` is retired; theme gallery lives at `/themes` here.
