# Agent notes — antora-extensions-registry

Project facts for agents. Workstation/env facts live only in `$CODE_ROOT/MEMORIES.md`.

- Public hostname: `registry.antora-supplemental.org` (Netlify). Repo name stays `antora-extensions-registry`.
- Themes (`ui.bundle`) are not Antora extensions; both are categories on this site.
- Production Better Auth: `BETTER_AUTH_URL=https://registry.antora-supplemental.org` and matching OAuth callbacks. DNS CNAME `registry` → Netlify (see welcome-site `DOMAIN.adoc`).
- Standalone `antora-themes-site` is retired; theme gallery lives at `/themes` here.
