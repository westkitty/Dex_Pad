import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderFeatureMatrix } from '../scripts/render-feature-matrix.mjs';

test('the human-readable feature matrix represents all 25 additions without false completions', async () => {
  const record = JSON.parse(await readFile(new URL('../planning/features.json', import.meta.url), 'utf8'));
  const markdown = renderFeatureMatrix(record);
  assert.match(markdown, /F01.*Project Resume Capsules/);
  assert.match(markdown, /F25.*Quiet, Actionable Alerts/);
  assert.equal((markdown.match(/^\| F\d\d \|/gm) || []).length, 25);
  assert.match(markdown, /development-only/);
  assert.doesNotMatch(markdown, /all features implemented/i);
});
