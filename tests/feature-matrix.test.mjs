import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const load = async () => JSON.parse(await readFile(new URL('../planning/features.json', import.meta.url), 'utf8'));

test('all 25 promised additions have distinct scoped acceptance checks', async () => {
  const features = await load();
  const additions = features.features.filter(x => /^F\d\d$/.test(x.id));
  assert.equal(additions.length, 25);
  assert.equal(new Set(additions.map(x => x.id)).size, 25);
  assert.deepEqual(additions.map(x => x.id), Array.from({length:25},(_,i)=>`F${String(i+1).padStart(2,'0')}`));
  for(const f of additions){
    assert.ok(f.acceptance.length > 24, `${f.id} missing meaningful acceptance`);
    assert.ok(f.surface.length > 3, `${f.id} missing scope owner`);
    assert.match(f.phase, /^P[0-5]$/);
  }
});

test('implementation dependencies resolve and cannot form cycles', async () => {
  const features = await load();
  const byId = new Map(features.features.map(x => [x.id,x]));
  assert.equal(byId.size,features.features.length);
  const walked = new Set();
  function visit(id, stack) {
    assert.ok(byId.has(id),`Missing referenced task ${id}`);
    assert.ok(!stack.has(id),`Circular dependency ${[...stack,id].join(' -> ')}`);
    if(walked.has(id)) return;
    stack.add(id);
    for(const dep of byId.get(id).dependsOn) visit(dep,stack);
    stack.delete(id);
    walked.add(id);
  }
  for(const f of features.features){
    assert.ok(['planned','dev-prototype','verified'].includes(f.status),`${f.id} invalid status`);
    assert.match(f.phase,/^P[0-5]$/);
    assert.ok(f.title && f.acceptance && f.surface);
    visit(f.id,new Set());
  }
});

test('no encrypted sync or actual GPT bridge capability is marked verified', async () => {
  const features = await load();
  for(const id of ['C02','C03','C07','C08','C13','C17','C18','C19','C21','C22']) {
    assert.equal(features.features.find(x=>x.id===id)?.status,'planned',`${id} cannot be called delivered`);
  }
});
