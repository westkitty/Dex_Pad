import { createWorkspace } from '../core/workspace.js';
import { createWriteOnlyGateway } from '../core/contributions.js';
import { createRelayBridge } from '../integrations/relay/bridge.js';
import { buildKnowledgeGraph, getBacklinksForItem } from '../core/relations.js';
import { createHandoffPacket } from '../core/handoff.js';
import { openIndexedDbStore } from '../storage/indexeddb.js';
import { createAcousticFeedback } from './audio.js';
import { mountGraphCanvas, prepareGraphTopology } from './graph-lens.js';

const $ = (selector) => document.querySelector(selector);
const CATEGORY = {
  note: { title: 'Notes', label: 'Note' },
  project: { title: 'Projects', label: 'Project' },
  decision: { title: 'Decisions', label: 'Decision' },
  incident: { title: 'Incidents', label: 'Incident' },
  commitment: { title: 'Commitments', label: 'Commitment' },
  topology: { title: 'Observatory', label: 'Observatory' },
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
  const timeEl = $('#save-time');
  if (timeEl) {
    if (value === 'Saved locally') {
      const now = new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      timeEl.textContent = `(${now})`;
      timeEl.title = `Durable local IndexedDB transaction confirmed at ${now}`;
    } else if (error) {
      timeEl.textContent = '';
    }
  }
}

async function main() {
  setStatus('Opening local storage...');
  const store = await openIndexedDbStore();
  const workspace = createWorkspace(store);
  const gateway = createWriteOnlyGateway(workspace);
  const relayBridge = createRelayBridge({ store, workspace });
  const audio = createAcousticFeedback();
  let collection = 'note';
  let selected = null;
  let dirty = false;
  let renderSerial = 0;
  let saving = false;
  let topologyInstance = null;

  let syncOnline = true;
  let syncState = 'SAVED_LOCALLY';
  let relayStoredCount = 0;
  let peerConfirmedCount = 0;
  let lastPushTime = null;
  let lastPeerTime = null;
  let lastReceiptSig = null;

  function updateSyncUi() {
    const stateEl = $('#sync-state');
    const localVal = $('#sync-local-val');
    const relayVal = $('#sync-relay-val');
    const relayMeta = $('#sync-relay-meta');
    const peerVal = $('#sync-peer-val');
    const peerMeta = $('#sync-peer-meta');
    if (!stateEl || !localVal || !relayVal || !peerVal) return;

    if (!syncOnline) {
      stateEl.textContent = 'Offline (buffered)';
      stateEl.style.color = '#f0c078';
      relayVal.textContent = 'BUFFERED';
      relayVal.className = 'sync-card-val pending';
      relayMeta.textContent = 'Network interrupted; outbox queued';
      return;
    }

    if (syncState === 'PEER_APPLIED') {
      stateEl.textContent = 'Peer applied ✓';
      stateEl.style.color = '#82c9a6';
      localVal.textContent = 'SAVED_LOCALLY';
      localVal.className = 'sync-card-val';
      relayVal.textContent = 'RELAY_STORED';
      relayVal.className = 'sync-card-val';
      relayMeta.textContent = `Uploaded to relay (${relayStoredCount} frames)`;
      peerVal.textContent = 'PEER_APPLIED';
      peerVal.className = 'sync-card-val';
      peerMeta.textContent = `Confirmed by dev-phone-02 (${lastReceiptSig ? lastReceiptSig.slice(0, 8) + '…' : 'verified'})`;
    } else if (syncState === 'RELAY_STORED') {
      stateEl.textContent = 'Relay stored';
      stateEl.style.color = '#afd4b9';
      localVal.textContent = 'SAVED_LOCALLY';
      localVal.className = 'sync-card-val';
      relayVal.textContent = 'RELAY_STORED';
      relayVal.className = 'sync-card-val';
      relayMeta.textContent = `Uploaded to relay at ${lastPushTime ? niceTime(lastPushTime) : 'just now'}`;
      peerVal.textContent = 'AWAITING';
      peerVal.className = 'sync-card-val awaiting';
      peerMeta.textContent = 'Awaiting peer device catch-up pull';
    } else {
      stateEl.textContent = 'Sync: Local';
      stateEl.style.color = '#94a9bc';
      localVal.textContent = 'SAVED_LOCALLY';
      localVal.className = 'sync-card-val';
      relayVal.textContent = 'PENDING';
      relayVal.className = 'sync-card-val pending';
      relayMeta.textContent = 'Awaiting manual or automatic push';
      peerVal.textContent = 'AWAITING';
      peerVal.className = 'sync-card-val awaiting';
      peerMeta.textContent = 'Awaiting relay storage and peer pull';
    }
  }

  function appendSyncLog(msg) {
    const log = $('#sync-inspector-log');
    if (log) log.textContent = msg;
  }

  async function updateCounts() {
    const items = await workspace.list({ includeDeleted: true });
    const counts = { note: 0, project: 0, decision: 0, incident: 0, commitment: 0, contribution: 0, archive: 0 };
    for (const item of items) { if (item.deletedAt) counts.archive++; else if (counts[item.kind] !== undefined) counts[item.kind]++; }
    for (const [kind, count] of Object.entries(counts)) {
      const label = kind === 'contribution' ? 'inbox' : kind === 'note' ? 'notes' : kind === 'project' ? 'projects' : kind === 'decision' ? 'decisions' : kind === 'incident' ? 'incidents' : kind === 'commitment' ? 'commitments' : 'archive';
      const el = $(`#count-${label}`);
      if (el) el.textContent = String(count);
    }
    const topoCount = items.filter(item => !item.deletedAt).length;
    const topoEl = $('#count-topology');
    if (topoEl) topoEl.textContent = String(topoCount);
  }
  async function renderList() {
    const serial = ++renderSerial;
    const query = $('#search-input').value;
    const matches = collection === 'archive'
      ? (await workspace.list({ query, includeDeleted: true })).filter(item => item.deletedAt)
      : collection === 'topology'
      ? (await workspace.list({ query, includeDeleted: false }))
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
  async function renderBacklinks() {
    const container = $('#backlinks-list');
    if (!container) return;
    container.replaceChildren();
    if (!selected) return;
    const allItems = await workspace.list({ includeDeleted: true });
    const graph = buildKnowledgeGraph(allItems);
    const backlinks = getBacklinksForItem({ graph, itemId: selected.id });
    if (!backlinks.length) {
      container.append(makeText('p', 'empty-panel', 'No incoming backlinks pointing to this record.'));
      return;
    }
    for (const link of backlinks) {
      const card = document.createElement('div');
      card.className = 'backlink-item';
      card.title = `Referenced from ${link.sourceTitle || 'Untitled'} (${link.relation})`;
      const relationBadge = makeText('span', 'backlink-relation', link.relation);
      const titleSpan = makeText('span', 'backlink-title', link.sourceTitle || 'Untitled');
      card.append(relationBadge);
      card.append(titleSpan);
      if (link.brokenTarget) {
        card.append(makeText('span', 'backlink-broken', 'Deleted source'));
      }
      card.addEventListener('click', () => { void openItem(link.sourceId); });
      container.append(card);
    }
  }

  function renderRunbookChecklist() {
    const runbookList = $('#runbook-steps-list');
    if (!runbookList) return;
    if (!selected || selected.kind !== 'incident') {
      runbookList.innerHTML = '<p class="empty-panel">Incident runbook checklist not active.</p>';
      return;
    }
    const reproText = $('#incident-repro')?.value || selected.reproductionSteps || '';
    const lines = reproText
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);

    runbookList.innerHTML = '';
    if (lines.length === 0) {
      runbookList.innerHTML = '<p class="empty-panel">Add numbered reproduction steps above to generate interactive checklist.</p>';
      return;
    }

    lines.forEach((line, idx) => {
      const item = document.createElement('label');
      item.className = 'runbook-step-item';
      const cleanText = line.replace(/^\d+[\.\)]\s*/, '');

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'runbook-step-checkbox';
      cb.id = `rb-step-${idx}`;

      const textSpan = document.createElement('span');
      const strong = document.createElement('strong');
      strong.textContent = `Step ${idx + 1}: `;
      textSpan.appendChild(strong);
      textSpan.appendChild(document.createTextNode(cleanText));

      item.appendChild(cb);
      item.appendChild(textSpan);

      cb.addEventListener('change', () => {
        item.classList.toggle('is-executed', cb.checked);
        if (cb.checked) {
          audio.tick();
          const allBoxes = Array.from(runbookList.querySelectorAll('.runbook-step-checkbox'));
          if (allBoxes.every(c => c.checked)) {
            audio.peerAck();
          }
        }
      });

      runbookList.appendChild(item);
    });
  }

  async function renderEditor() {
    if (collection === 'topology') {
      $('#editor-empty').hidden = true;
      $('#editor-form').hidden = true;
      $('#topology-panel').hidden = false;
      $('#editor-kind').textContent = 'OBSERVATORY';
      if (topologyInstance) {
        topologyInstance.destroy();
        topologyInstance = null;
      }
      const allRecords = await workspace.list({ includeDeleted: false });
      const topo = prepareGraphTopology(allRecords);
      $('#topo-nodes-count').textContent = String(topo.nodes.length);
      $('#topo-edges-count').textContent = String(topo.edges.length);
      $('#topo-broken-count').textContent = String(topo.brokenTargets.length);
      topologyInstance = mountGraphCanvas($('#topology-canvas-container'), allRecords, {
        onSelectNode: (itemId) => { void openItem(itemId); },
        audioFeedback: audio,
      });
      return;
    }

    $('#topology-panel').hidden = true;
    if (topologyInstance) {
      topologyInstance.destroy();
      topologyInstance = null;
    }

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
    $('#decision-fields').hidden = selected.kind !== 'decision';
    $('#incident-fields').hidden = selected.kind !== 'incident';
    $('#commitment-fields').hidden = selected.kind !== 'commitment';

    $('#decision-rationale').value = selected.rationale || '';
    $('#decision-alternatives').value = (selected.alternatives || []).join(', ');
    $('#decision-review').value = selected.reviewDate || '';
    $('#decision-superseded-by').value = selected.supersededBy || '';
    $('#decision-supersedes').value = selected.supersedes || '';

    $('#incident-status').value = selected.status || 'open';
    $('#incident-failure').value = selected.failureDescription || '';
    $('#incident-repro').value = selected.reproductionSteps || '';
    $('#incident-repair').value = selected.confirmedRepair || '';
    $('#incident-proof').value = selected.regressionProof || '';

    $('#commitment-status').value = selected.status || 'pending';
    $('#commitment-owner').value = selected.owner || '';
    $('#commitment-outcome').value = selected.expectedOutcome || '';
    $('#commitment-review').value = selected.reviewDate || '';

    // Epistemic Freshness Check
    const freshnessBanner = $('#epistemic-freshness-banner');
    const freshnessStatus = $('#freshness-status');
    const freshnessDetails = $('#freshness-details');
    if (freshnessBanner) {
      let isStale = false;
      let reasonText = '';
      if (selected.reviewDate) {
        const revTime = new Date(selected.reviewDate).getTime();
        if (Number.isFinite(revTime) && revTime < Date.now()) {
          isStale = true;
          reasonText = `Scheduled review date (${selected.reviewDate}) has expired. Human verification review required.`;
        }
      }
      if (selected.evidence === 'stale') {
        isStale = true;
        reasonText = reasonText || 'Evidence state is marked STALE. Citations or assumptions require re-verification.';
      }
      if (isStale) {
        freshnessBanner.hidden = false;
        freshnessBanner.className = 'freshness-banner';
        freshnessStatus.textContent = '⚠ NEEDS REVIEW: TEMPORAL DRIFT DETECTED';
        freshnessDetails.textContent = reasonText;
      } else {
        freshnessBanner.hidden = true;
      }
    }

    renderRunbookChecklist();
    updateResume();
    const archived = Boolean(selected.deletedAt);
    $('#delete-note').disabled = archived;
    $('#save-note').disabled = archived;
    for (const element of $('#editor-form').querySelectorAll('input,textarea,select')) element.disabled = archived;
    $('#save-status').textContent = archived ? 'Archived locally' : 'Saved locally';
    await renderHistory();
    await renderBacklinks();
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
    if (collection === 'topology') {
      collection = found.kind || 'note';
      $('#collection-title').textContent = CATEGORY[collection]?.title || 'Notes';
      for (const button of document.querySelectorAll('.nav-link')) {
        button.classList.toggle('is-active', button.dataset.kind === collection);
        button.setAttribute('aria-current', button.dataset.kind === collection ? 'page' : 'false');
      }
    }
    await renderEditor();
    await renderList();
  }
  async function changeCollection(kind) {
    if (dirty && !window.confirm('Discard unsaved changes?')) return;
    audio.tick();
    collection = kind;
    selected = null;
    dirty = false;
    $('#collection-title').textContent = CATEGORY[kind]?.title || 'Notes';
    const newBtn = $('#new-note');
    if (newBtn) {
      newBtn.hidden = kind === 'archive' || kind === 'topology';
      const singular = CATEGORY[kind]?.label ?? 'Item';
      newBtn.textContent = `+ New ${singular}`;
      newBtn.title = `Create a local ${singular.toLowerCase()} record`;
    }
    $('#simulate-gpt').hidden = kind !== 'contribution';
    $('#search-input').value = '';
    for (const button of document.querySelectorAll('.nav-link')) {
      button.classList.toggle('is-active', button.dataset.kind === kind);
      button.setAttribute('aria-current', button.dataset.kind === kind ? 'page' : 'false');
    }
    const host = $('#note-list');
    if (host && kind !== 'topology') {
      host.replaceChildren(
        ...Array.from({ length: 3 }, () => {
          const el = document.createElement('div');
          el.className = 'skeleton-card';
          return el;
        })
      );
    }
    await renderEditor();
    await renderList();
  }
  async function createNew() {
    if (collection === 'archive') return;
    if (dirty && !window.confirm('Discard unsaved changes?')) return;
    setStatus('Saving...');
    try {
      const targetKind = collection === 'topology' ? 'note' : collection;
      if (collection === 'topology') {
        collection = 'note';
        $('#collection-title').textContent = CATEGORY['note']?.title || 'Notes';
        const newBtn = $('#new-note');
        if (newBtn) {
          newBtn.textContent = '+ New Note';
          newBtn.title = 'Create a local note record';
        }
        for (const button of document.querySelectorAll('.nav-link')) {
          button.classList.toggle('is-active', button.dataset.kind === 'note');
          button.setAttribute('aria-current', button.dataset.kind === 'note' ? 'page' : 'false');
        }
      }
      selected = await workspace.create({ kind: targetKind });
      dirty = false;
      await updateCounts();
      await renderEditor();
      await renderList();
      setStatus('Saved locally');
      syncState = 'SAVED_LOCALLY';
      updateSyncUi();
      appendSyncLog('New record created locally. Pending relay upload.');
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
      rationale: $('#decision-rationale')?.value || '',
      alternatives: $('#decision-alternatives')?.value ? $('#decision-alternatives').value.split(',').map(s => s.trim()).filter(Boolean) : [],
      reviewDate: selected.kind === 'decision' ? ($('#decision-review')?.value || null) : selected.kind === 'commitment' ? ($('#commitment-review')?.value || null) : (selected.reviewDate || null),
      supersededBy: $('#decision-superseded-by')?.value || null,
      supersedes: $('#decision-supersedes')?.value || null,
      failureDescription: $('#incident-failure')?.value || '',
      reproductionSteps: $('#incident-repro')?.value || '',
      confirmedRepair: $('#incident-repair')?.value || '',
      regressionProof: $('#incident-proof')?.value || '',
      status: selected.kind === 'incident' ? ($('#incident-status')?.value || 'open') : selected.kind === 'commitment' ? ($('#commitment-status')?.value || 'pending') : (selected.status || null),
      owner: $('#commitment-owner')?.value || '',
      expectedOutcome: $('#commitment-outcome')?.value || '',
    };
    try {
      selected = await workspace.update(selected.id, patch, selected.revision);
      dirty = false;
      audio.commit();
    } catch (error) {
      $('#save-error').textContent = error?.message ?? 'Local save failed';
      setStatus('Not saved', { error: true });
      dirty = true;
      audio.alert();
      return;
    } finally {
      saving = false;
      if (selected && !selected.deletedAt) $('#save-note').disabled = false;
    }
    await renderEditor();
    await renderList();
    syncState = 'SAVED_LOCALLY';
    updateSyncUi();
    appendSyncLog('Record saved in local storage. Pending relay upload.');
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

  async function exportHandoff() {
    if (!selected) return;
    try {
      const packet = await createHandoffPacket({
        workspace,
        selectedItemIds: [selected.id],
        purpose: 'agent-task-context',
        constraints: ['No unverified claims presented as verified', 'Zero external runtime dependencies'],
      });
      const blob = new Blob([JSON.stringify(packet, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `dex-handoff-${selected.id.slice(0, 8)}.json`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      appendSyncLog(`One-tap agent handoff exported for item ${selected.id.slice(0, 8)} (${packet.selectedItemsCount} items).`);
    } catch (error) {
      window.alert(`Handoff export failed: ${error.message}`);
    }
  }

  $('#open-sync-inspector')?.addEventListener('click', () => {
    audio.tick();
    const panel = $('#sync-inspector');
    if (!panel) return;
    panel.hidden = !panel.hidden;
    updateSyncUi();
  });
  $('#close-sync-inspector')?.addEventListener('click', () => {
    audio.tick();
    const panel = $('#sync-inspector');
    if (panel) panel.hidden = true;
  });
  $('#sync-push-btn')?.addEventListener('click', () => {
    audio.tick();
    if (!syncOnline) {
      appendSyncLog('Push blocked: network simulation is offline. Encrypted frame retained in local outbox.');
      updateSyncUi();
      return;
    }
    relayStoredCount++;
    lastPushTime = new Date().toISOString();
    syncState = 'RELAY_STORED';
    appendSyncLog(`[Relay Push] Encrypted frame uploaded to Big Mac relay (seq #${relayStoredCount}). Relay receives ciphertext only; content remains private.`);
    updateSyncUi();
  });
  $('#sync-peer-ack-btn')?.addEventListener('click', () => {
    if (syncState !== 'RELAY_STORED' && syncState !== 'PEER_APPLIED') {
      audio.alert();
      appendSyncLog('Peer cannot catch up: no frames have been stored on relay yet. Push to relay first.');
      return;
    }
    audio.peerAck();
    peerConfirmedCount++;
    lastPeerTime = new Date().toISOString();
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    lastReceiptSig = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    syncState = 'PEER_APPLIED';
    appendSyncLog(`[Peer Confirmation] Device dev-phone-02 pulled frame, decrypted with vault key, and posted signed peer receipt (${lastReceiptSig.slice(0, 16)}…).`);
    updateSyncUi();
  });
  $('#sync-network-toggle-btn')?.addEventListener('click', () => {
    audio.tick();
    syncOnline = !syncOnline;
    $('#sync-network-toggle-btn').textContent = syncOnline ? 'Toggle Network (Online)' : 'Toggle Network (Offline)';
    appendSyncLog(syncOnline ? 'Network restored (Online). Relay connection re-established.' : 'Network interrupted (Offline). Offline writing and local buffering active.');
    updateSyncUi();
  });

  $('#audio-toggle-btn')?.addEventListener('click', () => {
    const nextMuted = !audio.isMuted();
    audio.setMuted(nextMuted);
    const label = $('#audio-label');
    const icon = $('#audio-icon');
    if (label) label.textContent = nextMuted ? 'Audio: Muted' : 'Audio: On';
    if (icon) icon.textContent = nextMuted ? '✕' : '♪';
    if (!nextMuted) audio.tick();
  });

  $('#welcome-topology')?.addEventListener('click', () => {
    audio.tick();
    void changeCollection('topology');
  });

  for (const button of document.querySelectorAll('.nav-link')) button.addEventListener('click', () => { void changeCollection(button.dataset.kind); });
  $('#new-note').addEventListener('click', () => { audio.tick(); void createNew(); });
  $('#welcome-create').addEventListener('click', () => { audio.tick(); void createNew(); });
  $('#editor-form').addEventListener('submit', saveItem);
  $('#delete-note').addEventListener('click', () => { void archiveItem(); });
  $('#simulate-gpt').addEventListener('click', () => { audio.tick(); void createSyntheticContribution(); });
  $('#simulate-relay-event')?.addEventListener('click', () => { audio.tick(); void simulateRelayEvent(false); });
  $('#simulate-relay-blocked')?.addEventListener('click', () => { audio.alert(); void simulateRelayEvent(true); });
  $('#export-data').addEventListener('click', () => { audio.tick(); exportLocal(); });
  $('#export-handoff')?.addEventListener('click', () => { audio.tick(); void exportHandoff(); });
  $('#search-input').addEventListener('input', () => { void renderList(); });
  $('#incident-repro')?.addEventListener('input', () => { renderRunbookChecklist(); });
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
  updateSyncUi();
  setStatus('Ready');
}

main().catch(error => {
  setStatus('Storage unavailable', { error: true });
  $('#editor-empty').replaceChildren(makeText('p', 'empty-panel', `Unable to initialize local development storage: ${error.message}. No changes can be saved.`));
  $('#new-note').disabled = true;
  $('#welcome-create').disabled = true;
});
