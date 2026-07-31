#!/usr/bin/env bash
# Provision Turso for antora-extensions-registry.
# Requires: turso CLI installed and authenticated (`turso auth login`).
set -euo pipefail

OLD_DB="${TURSO_DELETE_DB:-antora-themes}"
NEW_DB="${TURSO_NEW_DB:-antora-extensions-registry}"

if ! command -v turso >/dev/null 2>&1; then
  echo "Turso CLI not found. Install: curl -sSfL https://get.tur.so/install.sh | bash"
  exit 1
fi

echo "Listing databases..."
turso db list

if turso db show "$OLD_DB" >/dev/null 2>&1; then
  echo "Destroying old database: $OLD_DB"
  turso db destroy "$OLD_DB" --yes
else
  echo "Old database '$OLD_DB' not found — skipping delete"
fi

if turso db show "$NEW_DB" >/dev/null 2>&1; then
  echo "Database '$NEW_DB' already exists"
else
  echo "Creating database: $NEW_DB"
  turso db create "$NEW_DB"
fi

echo ""
echo "Set these in Netlify and GitHub secrets:"
echo "DB_URL=$(turso db show "$NEW_DB" --url)"
echo "DB_AUTH_TOKEN=$(turso db tokens create "$NEW_DB")"
