# TODO - Antora Extensions Registry

## Custom domain (registry.antora-supplemental.org)

- [ ] Add `registry.antora-supplemental.org` in Netlify Domain management (see `DOMAIN.adoc`).
- [ ] Registrar CNAME `registry` → Netlify site hostname.
- [ ] Set `BETTER_AUTH_URL` / `BETTER_AUTH_TRUSTED_ORIGINS` to `https://registry.antora-supplemental.org`.
- [ ] Point OAuth callbacks at `https://registry.antora-supplemental.org/api/auth/callback/<provider>`.

## Authentication Setup

- [x] Better Auth with account linking at `/auth/account` (`allowDifferentEmails`).
- [ ] Create OAuth Application on **GitHub** (antora-supplemental organization).
- [ ] Create OAuth Application on **GitLab**.
- [ ] Create OAuth Application on **Google Cloud Console**.
- [ ] Create OAuth Application on **Microsoft Azure Portal**.
- [ ] Create **Apple** Services ID and generate `APPLE_CLIENT_SECRET` via `scripts/generate-apple-client-secret.ts`.
- [ ] Configure **SMTP** or a transactional email provider for magic links.
- [ ] Set `BETTER_AUTH_SECRET` and provider IDs/secrets in Netlify environment variables.
- [ ] (Future) Custom admin merge tool for duplicate user records — not provided by Better Auth upstream.

## Database & Deployment

- [ ] Create a Turso database (`libsql://…`) — **required**; `file:` databases do not persist on Netlify.
- [ ] Set `DB_URL` and `DB_AUTH_TOKEN` in Netlify and GitHub Actions secrets.
- [ ] Run `pnpm db:push` against the Turso database.
- [ ] Add `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID`, `BETTER_AUTH_SECRET`, `DB_URL`, and `DB_AUTH_TOKEN` as GitHub repository secrets.
- [ ] Verify the Netlify deploy workflow on push to `main`.

## Backend Enhancements

- [ ] Implement actual `package.json` fetching from remote URLs (GitHub/GitLab APIs).
- [ ] Add caching for dependency trees to avoid re-computing.
- [ ] Implement rate limiting for extension submissions.

## Frontend Polishing

- [x] Omni-search on home with category chips (extensions / themes / packages).
- [ ] Add more micro-animations to the tree expansion.
- [ ] Add user profiles to manage submitted extensions.
