import { createWorkspace } from '../core/workspace.js';
import { createWriteOnlyGateway } from '../core/contributions.js';
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
  for (const button of document.querySelectorAll('.nav-link')) button.addEventListener('click', () => { void changeCollection(button.dataset.kind); });
  $('#new-note').addEventListener('click', () => { void createNew(); });
  $('#welcome-create').addEventListener('click', () => { void createNew(); });
  $('#editor-form').addEventListener('submit', saveItem);
  $('#delete-note').addEventListener('click', () => { void archiveItem(); });
  $('#simulate-gpt').addEventListener('click', () => { void createSyntheticContribution(); });
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
