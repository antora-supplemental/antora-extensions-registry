import type { GroupDecl } from '../lib/catalog-groups';

/**
 * Curated canonical grouping (`variantOf` / `supersededBy`) for entries whose repository cannot say it in
 * package.json: repositories we do not own, or a repository whose entries need different values (one package.json
 * per repo). Declared `antoraRegistry` values win over these. Keys are catalog ids; targets are
 * `host/owner/repo/package` or catalog ids. See docs/modules/ROOT/pages/registry-metadata.adoc.
 */
export const CURATED_GROUPS: Record<string, GroupDecl> = {
  // Compatibility repo: its README says dark mode moved to antora-ui-chassis (antora-dark-mode 2.x is published there).
  'antora-supplemental/antora-dark-mode/dark-mode': {
    supersededBy: 'github.com/antora-supplemental/antora-ui-chassis/light-dark-mode',
  },
  'antora-supplemental/antora-dark-mode/dark-mode-only': {
    variantOf: 'github.com/antora-supplemental/antora-ui-chassis/light-dark-mode',
    variantLabel: 'Recipe: dark mode toggle and styles layered on any UI bundle, without composing the chassis yourself',
  },
};
