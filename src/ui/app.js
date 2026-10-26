import { createWorkspace } from '../core/workspace.js';
import { createWriteOnlyGateway } from '../core/contributions.js';
import { createRelayBridge } from '../integrations/relay/bridge.js';
import { openIndexedDbStore } from '../storage/indexeddb.js';

const $ = (selector) => document.querySelector(selector);
const CATEGORY = {
  note: { title: 'Notes', label: 'Note' },
  project: { title: 'Projects', label: 'Project' },
  decision: { title: 'Decisions', label: 'Decision' },
  contribution: { title: 'Contributions', label: 'Contribution' },
  archive: { title: 'Archive', label: 'Archived' },
};

function makeText(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  el.textContent = text;
  return el;
}
function summary(item) {
  return item.title.trim() || (item.body.trim() ? item.body.trim().slice(0, 65) : 'Untitled');
}
function niceTime(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Unknown date';
}
function setStatus(value, { error = false } = {}) {
  const el = $('#save-status');
  el.textContent = value;
  el.style.color = error ? 'var(--red)' : value === 'Saved locally' ? '#afd4b9' : 'var(--muted)';
}

async function main() {
  setStatus('Opening local storage...');
  const store = await openIndexedDbStore();
  const workspace = createWorkspace(store);
  const gateway = createWriteOnlyGateway(workspace);
  const relayBridge = createRelayBridge({ store, workspace });
  let collection = 'note';
  let selected = null;
  let dirty = false;
  let renderSerial = 0;
  let saving = false;

  async function updateCounts() {
    const items = await workspace.list({ includeDeleted: true });
    const counts = { note: 0, project: 0, decision: 0, contribution: 0, archive: 0 };
    for (const item of items) { if (item.deletedAt) counts.archive++; else if (counts[item.kind] !== undefined) counts[item.kind]++; }
    for (const [kind, count] of Object.entries(counts)) {
      const label = kind === 'contribution' ? 'inbox' : kind === 'note' ? 'notes' : kind === 'project' ? 'projects' : kind === 'decision' ? 'decisions' : 'archive';
      $(`#count-${label}`).textContent = String(count);
    }
  }
  async function renderList() {
    const serial = ++renderSerial;
    const query = $('#search-input').value;
    const matches = collection === 'archive'
      ? (await workspace.list({ query, includeDeleted: true })).filter(item => item.deletedAt)
      : await workspace.list({ query, kind: collection });
    if (serial !== renderSerial) return;
    const host = $('#note-list');
    host.replaceChildren();
    if (!matches.length) {
      host.append(makeText('p', 'empty-panel', query ? 'No matching records on this device.' : collection === 'archive' ? 'Nothing archived yet.' : 'Nothing here yet. Create a synthetic record to begin.'));
      return;
    }
    for (const item of matches) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `item-card${selected?.id === item.id ? ' is-selected' : ''}`;
      card.setAttribute('role', 'listitem');
      card.setAttribute('aria-label', `Open ${summary(item)}`);
      card.append(makeText('span', 'item-card-title', summary(item)));
      card.append(makeText('span', 'item-card-preview', item.body.trim().replaceAll('\n', ' ').slice(0, 140) || item.nextAction || 'No content yet'));
      const meta = makeText('span', 'item-meta', '');
      meta.append(makeText('span', '', item.deletedAt ? 'Archived' : item.evidence));
      meta.append(makeText('span', '', `${niceTime(item.updatedAt)} / r${item.revision}`));
      card.append(meta);
      card.addEventListener('click', () => { void openItem(item.id); });
      host.append(card);
    }
  }
  function updateResume() {
    const area = $('#resume-panel');
    area.replaceChildren();
    if (!selected || selected.kind !== 'project') return;
    const title = makeText('strong', '', 'Next: ');
    const line = makeText('div', '', $('#project-next').value || 'No next action set');
    line.prepend(title);
    area.append(line);
    if ($('#project-blocker').value.trim()) {
      const blocker = makeText('div', '', `Blocker: ${$('#project-blocker').value}`);
      area.append(blocker);
    }
  }
  async function renderRelayTimeline(projectId) {
    const list = $('#relay-timeline-list');
    list.replaceChildren();
    if (!projectId) return;
    const events = await relayBridge.getProjectTimeline(projectId);
    if (!events.length) {
      list.append(makeText('p', 'empty-panel', 'No synthetic relay events associated with this project. Click "Ingest fixture relay event" to test ingestion.'));
      return;
    }
    for (const item of [...events].reverse()) {
      const card = document.createElement('div');
      card.className = 'relay-card';

      const header = document.createElement('div');
      header.className = 'relay-card-header';
      header.append(makeText('span', 'relay-card-title', `Seq #${item.sequence} • ${item.action}`));

      const badgeClass =
        item.verificationStatus === 'UNVERIFIED_CLAIM' ? 'relay-badge-unverified' :
        item.verificationStatus === 'BLOCKED' ? 'relay-badge-blocked' :
        item.verificationStatus === 'AMBIGUOUS' ? 'relay-badge-ambiguous' :
        item.verificationStatus === 'EVIDENCE_REFERENCED' ? 'relay-badge-evidence' : 'relay-badge-claimed';

      const badgeLabel =
        item.verificationStatus === 'UNVERIFIED_CLAIM' ? 'Unverified claim' :
        item.verificationStatus === 'BLOCKED' ? 'Blocked' :
        item.verificationStatus === 'AMBIGUOUS' ? 'Ambiguous' :
        item.verificationStatus === 'EVIDENCE_REFERENCED' ? 'Evidence ref' : 'Source claim';

      header.append(makeText('span', `relay-badge ${badgeClass}`, badgeLabel));
      card.append(header);

      const integrity = document.createElement('div');
      if (item.streamIntegrity === 'MISSING_PREDECESSOR') {
        integrity.className = 'relay-integrity gap';
        integrity.textContent = '⚠️ Incomplete stream: missing predecessor event';
      } else if (item.streamIntegrity === 'HASH_CHAIN_MISMATCH') {
        integrity.className = 'relay-integrity gap';
        integrity.textContent = '⚠️ Hash chain mismatch: predecessor hash does not match';
      } else {
        integrity.className = 'relay-integrity valid';
        integrity.textContent = '✓ Continuous event sequence';
      }
      card.append(integrity);

      const meta = document.createElement('div');
      meta.className = 'relay-meta';
      meta.append(makeText('span', '', `Stage: ${item.stage}`));
      meta.append(makeText('span', '', `Route: ${item.sourceNodeId} → ${item.targetNodeId}`));
      meta.append(makeText('span', '', `Time: ${niceTime(item.atUtc)}`));
      card.append(meta);

      const refs = document.createElement('div');
      refs.className = 'relay-meta';
      refs.append(makeText('span', '', `Task: ${item.taskId}`));
      refs.append(makeText('span', '', `Hash: ${item.eventHash.slice(0, 16)}…`));
      if (item.receiptHash) refs.append(makeText('span', '', `Receipt: ${item.receiptHash.slice(0, 16)}…`));
      card.append(refs);

      if (item.payload && Object.keys(item.payload).length > 0) {
        const payloadBox = document.createElement('pre');
        payloadBox.className = 'relay-payload';
        payloadBox.textContent = JSON.stringify(item.payload, null, 2);
        card.append(payloadBox);
      }

      list.append(card);
    }
  }
  async function renderHistory() {
    const host = $('#revisions-panel');
    host.replaceChildren();
    if (!selected) return;
    const versions = await workspace.history(selected.id);
    for (const revision of [...versions].reverse()) {
      const button = makeText('button', '', `Restore revision ${revision.revision}`);
      button.type = 'button';
      button.title = `${revision.deletedAt ? 'Archived revision' : 'Revision'} ${revision.revision} (${niceTime(revision.updatedAt)})`;
      button.disabled = saving;
      button.addEventListener('click', async () => {
        if (dirty && !window.confirm('Discard unsaved edits and restore this revision?')) return;
        if (!window.confirm(`Create a new revision from revision ${revision.revision}?`)) return;
        setStatus('Restoring...');
        try {
          const restored = await workspace.restore(selected.id, revision.revision, selected.revision);
          selected = restored;
          dirty = false;
          await renderEditor();
          await updateCounts();
          await renderList();
          setStatus('Saved locally');
        } catch (error) { $('#save-error').textContent = error.message; setStatus('Not saved', { error: true }); }
      });
      host.append(button);
    }
  }
  async function renderEditor() {
    $('#editor-empty').hidden = Boolean(selected);
    $('#editor-form').hidden = !selected;
    $('#save-error').textContent = '';
    if (!selected) { $('#editor-kind').textContent = CATEGORY[collection]?.label.toUpperCase() || 'NOTE'; return; }
    $('#editor-kind').textContent = CATEGORY[selected.kind]?.label.toUpperCase() || 'NOTE';
    $('#kind-chip').textContent = CATEGORY[selected.kind]?.label || 'Note';
    $('#revision-label').textContent = `Revision ${selected.revision}`;
    $('#editor-title').value = selected.title;
    $('#editor-body').value = selected.body;
    $('#editor-tags').value = selected.tags.join(', ');
    $('#evidence-state').value = selected.evidence;
    $('#evidence-ref').value = selected.evidenceRef;
    $('#project-next').value = selected.nextAction || '';
    $('#project-blocker').value = selected.blocker || '';
    $('#project-repo').value = selected.repoUrl || '';
    $('#project-fields').hidden = selected.kind !== 'project';
    updateResume();
    const archived = Boolean(selected.deletedAt);
    $('#delete-note').disabled = archived;
    $('#save-note').disabled = archived;
    for (const element of $('#editor-form').querySelectorAll('input,textarea,select')) element.disabled = archived;
    $('#save-status').textContent = archived ? 'Archived locally' : 'Saved locally';
    await renderHistory();
    if (selected.kind === 'project') {
      await renderRelayTimeline(selected.id);
    }
  }
  async function openItem(itemId) {
    if (dirty && !window.confirm('Discard unsaved changes?')) return;
    const found = (await workspace.list({ includeDeleted: true })).find(item => item.id === itemId);
    if (!found) return;
    selected = found;
    dirty = false;
    await renderEditor();
    await renderList();
  }
  async function changeCollection(kind) {
    if (dirty && !window.confirm('Discard unsaved changes?')) return;
    collection = kind;
    selected = null;
    dirty = false;
    $('#collection-title').textContent = CATEGORY[kind].title;
    $('#new-note').hidden = kind === 'archive';
    $('#simulate-gpt').hidden = kind !== 'contribution';
    $('#search-input').value = '';
    for (const button of document.querySelectorAll('.nav-link')) {
      button.classList.toggle('is-active', button.dataset.kind === kind);
      button.setAttribute('aria-current', button.dataset.kind === kind ? 'page' : 'false');
    }
    await renderEditor();
    await renderList();
  }
  async function createNew() {
    if (collection === 'archive') return;
    if (dirty && !window.confirm('Discard unsaved changes?')) return;
    setStatus('Saving...');
    try {
      selected = await workspace.create({ kind: collection });
      dirty = false;
      await updateCounts();
      await renderEditor();
      await renderList();
      setStatus('Saved locally');
      $('#editor-title').focus();
    } catch (error) { setStatus('Not saved', { error: true }); $('#save-error').textContent = error.message; }
  }
  async function saveItem(event) {
    event?.preventDefault();
    if (!selected || selected.deletedAt || saving) return;
    saving = true;
    $('#save-note').disabled = true;
    $('#save-error').textContent = '';
    setStatus('Saving...');
    const patch = {
      title: $('#editor-title').value,
      body: $('#editor-body').value,
      tags: $('#editor-tags').value.split(',').map(s => s.trim()).filter(Boolean),
      evidence: $('#evidence-state').value,
      evidenceRef: $('#evidence-ref').value,
      nextAction: $('#project-next').value,
      blocker: $('#project-blocker').value,
      repoUrl: $('#project-repo').value,
    };
    try {
      selected = await workspace.update(selected.id, patch, selected.revision);
      dirty = false;
    } catch (error) {
      $('#save-error').textContent = error?.message ?? 'Local save failed';
      setStatus('Not saved', { error: true });
      dirty = true;
      return;
    } finally {
      saving = false;
      if (selected && !selected.deletedAt) $('#save-note').disabled = false;
    }
    await renderEditor();
    await renderList();
    setStatus('Saved locally');
  }
  async function archiveItem() {
    if (!selected || selected.deletedAt) return;
    if (!window.confirm('Archive this item? Its revision history will remain available in Archive.')) return;
    setStatus('Archiving...');
    try {
      selected = await workspace.remove(selected.id, selected.revision);
      dirty = false;
      await renderEditor();
      await updateCounts();
      await renderList();
      setStatus('Archived locally');
    } catch (error) { $('#save-error').textContent = error.message; setStatus('Not saved', { error: true }); }
  }
  async function createSyntheticContribution() {
    setStatus('Saving...');
    try {
      const requestId = crypto.randomUUID();
      await gateway.acceptContribution({ requestId, title: 'Synthetic GPT contribution', body: 'This fixture demonstrates a write-only contribution receipt. No GPT service is connected.' });
      dirty = false;
      const latest = await workspace.list({ kind: 'contribution' });
      selected = latest.find(item => item.id === `contribution:${requestId}`) ?? null;
      await updateCounts();
      await renderEditor();
      await renderList();
      setStatus('Saved locally');
    } catch (error) { $('#save-error').textContent = error.message; setStatus('Not saved', { error: true }); }
  }
  async function exportLocal() {
    if (!window.confirm('Export ALL development records, including contents and revision history, as UNENCRYPTED JSON? Use synthetic data only.')) return;
    try {
      const payload = await workspace.exportData();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'dex-pad-development-export.json';
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (error) { window.alert(`Export failed: ${error.message}`); }
  }
  async function simulateRelayEvent(blocked = false) {
    if (!selected || selected.kind !== 'project') return;
    setStatus('Ingesting relay event...');
    try {
      const existing = await relayBridge.getProjectTimeline(selected.id);
      const seq = existing.length + 1;
      const prevHash = seq > 1 ? existing[seq - 2].eventHash : null;

      const randomBytes = new Uint8Array(32);
      crypto.getRandomValues(randomBytes);
      const eventHash = Array.from(randomBytes, b => b.toString(16).padStart(2, '0')).join('');

      const event = {
        schemaVersion: 'dex-relay.event.v1',
        eventId: `evt-${crypto.randomUUID().slice(0, 8)}`,
        taskId: `task-${selected.id.slice(0, 8)}`,
        correlationId: `corr-${crypto.randomUUID().slice(0, 8)}`,
        sourceNodeId: 'bigmac-node',
        targetNodeId: 'macbook-node',
        idempotencyKey: `idemp-${crypto.randomUUID()}`,
        sequence: seq,
        previousEventHash: prevHash,
        eventHash,
        receiptHash: blocked ? null : 'd'.repeat(64),
        resultHash: null,
        action: blocked ? 'BLOCKED' : 'CODEX_COMPLETED',
        stage: blocked ? 'BLOCKED' : 'CODEX_DONE',
        atUtc: new Date().toISOString(),
        payload: blocked
          ? { blocker: 'Missing authorization policy on target node', reason: 'Access restricted' }
          : { summary: `Synthetic task step ${seq} completed successfully` },
      };

      await relayBridge.ingestEvent(selected.id, event);
      await renderRelayTimeline(selected.id);
      setStatus('Saved locally');
    } catch (error) {
      $('#save-error').textContent = error.message;
      setStatus('Not saved', { error: true });
    }
  }

  for (const button of document.querySelectorAll('.nav-link')) button.addEventListener('click', () => { void changeCollection(button.dataset.kind); });
  $('#new-note').addEventListener('click', () => { void createNew(); });
  $('#welcome-create').addEventListener('click', () => { void createNew(); });
  $('#editor-form').addEventListener('submit', saveItem);
  $('#delete-note').addEventListener('click', () => { void archiveItem(); });
  $('#simulate-gpt').addEventListener('click', () => { void createSyntheticContribution(); });
  $('#simulate-relay-event')?.addEventListener('click', () => { void simulateRelayEvent(false); });
  $('#simulate-relay-blocked')?.addEventListener('click', () => { void simulateRelayEvent(true); });
  $('#export-data').addEventListener('click', exportLocal);
  $('#search-input').addEventListener('input', () => { void renderList(); });
  for (const field of $('#editor-form').querySelectorAll('input,textarea,select')) {
    field.addEventListener('input', () => { if (selected && !selected.deletedAt) { dirty = true; setStatus('Unsaved changes'); $('#save-error').textContent = ''; updateResume(); } });
    field.addEventListener('change', () => { if (selected && !selected.deletedAt) { dirty = true; setStatus('Unsaved changes'); $('#save-error').textContent = ''; updateResume(); } });
  }
  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); $('#search-input').focus(); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n') { event.preventDefault(); void createNew(); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void saveItem(); }
  });
  window.addEventListener('beforeunload', (event) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
  await updateCounts();
  await renderList();
  setStatus('Ready');
}

main().catch(error => {
  setStatus('Storage unavailable', { error: true });
  $('#editor-empty').replaceChildren(makeText('p', 'empty-panel', `Unable to initialize local development storage: ${error.message}. No changes can be saved.`));
  $('#new-note').disabled = true;
  $('#welcome-create').disabled = true;
});
