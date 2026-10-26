import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

export function renderFeatureMatrix(data) {
  const entries = data.features;
  const count = entries.filter(x => /^F\d\d$/.test(x.id)).length;
  const lines = [
    '# DEX//Pad: Full Feature Program',
    '',
    `**${entries.length} contracts total: ${count} new additions plus ${entries.length - count} core capabilities.**`,
    '',
    'This table is generated from `planning/features.json`. It is a **development backlog, not proof of delivery**.',
    '',
    'Status meanings: `planned` = specification only; `dev-prototype` = development-only partial implementation; `verified` = complete end-to-end proof with evidence.',
    '',
    '## Release gates',
    '',
  ];
  for (const [phase, title] of Object.entries(data.phases)) lines.push(`- **${phase}** - ${title}`);
  lines.push('', '## Core capabilities', '', '| ID | Capability | Phase | Status | Depends on | Acceptance |', '|---|---|---|---|---|---|');
  const row = f => `| ${f.id} | ${f.title.replaceAll('|', '/')} | ${f.phase} | ${f.status} | ${f.dependsOn.join(', ') || '-'} | ${f.acceptance.replaceAll('|', '/')} |`;
  for (const f of entries.filter(x => x.id.startsWith('C'))) lines.push(row(f));
  lines.push('', '## 25 additional capabilities', '', '| ID | Capability | Phase | Status | Depends on | Acceptance |', '|---|---|---|---|---|---|');
  for (const f of entries.filter(x => x.id.startsWith('F'))) lines.push(row(f));
  lines.push('', '## Execution rule', '',
    'One cohort is implemented and validated before widening scope. P0/P1 privacy and durability gates must pass before any personal data or external integrations are allowed.',
    'The synthetic demonstration facade does not grant an actual GPT connection access to the vault.', '',
    '## Source of truth', '',
    'Edit `planning/features.json`, then run `node scripts/render-feature-matrix.mjs --write`. `npm run check` refuses stale generated documentation.', '');
  return lines.join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const data = JSON.parse(await readFile(resolve(root, 'planning/features.json'), 'utf8'));
  const actual = renderFeatureMatrix(data);
  const target = resolve(root, 'docs/FEATURE_MATRIX.md');
  if (process.argv.includes('--write')) {
    await writeFile(target, actual, 'utf8');
    console.log('Feature matrix regenerated from planning/features.json.');
  } else if (process.argv.includes('--check')) {
    const existing = await readFile(target, 'utf8');
    if (existing !== actual) { console.error('Feature matrix out of date. Run --write.'); process.exitCode = 1; }
    else console.log('Feature matrix is current.');
  } else {
    console.log(actual);
  }
}
