/**
 * One or two plain sentences shown above an install snippet: what the snippet is and where it goes.
 * Based on the entry's type and layers/bundle so it is right for extensions, compose packs and UI modules.
 */
import type { ExtensionCatalogEntry } from '~/types/ui-module';

export const INSTALL_GUIDE_URL = 'https://docs.antora-supplemental.org/registry/install-guide/';

export function installGuidance(entry: ExtensionCatalogEntry): string[] {
  const pkg = entry.privatePackage ? `github:${entry.repositoryOwner}/${entry.repositoryName}` : entry.name;
  const installCmd = `pnpm add -D ${pkg}`;
  if (entry.type === 'antora-extension') {
    if (entry.bundle) {
      return [
        `This is a compose pack. In the folder that holds your antora-playbook.yml, run \`${installCmd}\`, then add the \`require\` line under \`antora.extensions\` in antora-playbook.yml.`,
        'The pack loads its member extensions itself, so do not register them separately.',
      ];
    }
    const paint = entry.layers?.includes('paint');
    return [
      `This is an Antora extension. In the folder that holds your antora-playbook.yml, run \`${installCmd}\`, then add the \`require\` line under \`antora.extensions\` in antora-playbook.yml.`,
      paint
        ? 'It changes the look at build time on top of your current UI bundle, so leave `ui.bundle.url` as it is.'
        : 'It runs when Antora builds the site; your UI bundle (`ui.bundle.url`) does not change.',
    ];
  }
  if (entry.type === 'ui-recipe') {
    return [
      'This is a UI recipe, a set of UI modules applied together by the ui-modules orchestrator. Add this block under `antora.extensions` in antora-playbook.yml, with the ui-modules folder checked out next to the playbook.',
      'The orchestrator merges the modules into your UI bundle at build time, so `ui.bundle.url` stays as it is.',
    ];
  }
  return [
    'This is a UI module, installed through the ui-modules orchestrator extension. Add this block under `antora.extensions` in antora-playbook.yml, with the ui-modules folder checked out next to the playbook.',
    'The orchestrator merges the module into your UI bundle at build time, so `ui.bundle.url` stays as it is. Full themes are different: they replace the bundle at `ui.bundle.url`.',
  ];
}
