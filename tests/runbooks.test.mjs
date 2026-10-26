import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRunbookCard,
  executeRunbookStep,
  createDeviceSessionContext,
  restoreDeviceSessionContext,
  RunbookError,
  SessionHandoffError,
} from '../src/core/runbooks.js';

test('1. createRunbookCard lists steps, checks, stop conditions, and rollback (F09)', () => {
  const runbook = createRunbookCard({
    title: 'Emergency Offline Recovery Runbook',
    projectId: 'project:dex-pad',
    steps: [
      { stepIndex: 1, title: 'Verify offline local store', expectedCheck: 'Store opens with indexedDB' },
      { stepIndex: 2, title: 'Export encrypted snapshot', expectedCheck: 'dex-backup.v1 archive generated' },
    ],
    stopConditions: ['Network interface comes online prematurely', 'Tampered ciphertext detected'],
    rollbackSteps: ['Discard corrupted temp workspace', 'Restore from offline backup file'],
  });

  assert.equal(runbook.schemaVersion, 'dex-runbook.v1');
  assert.match(runbook.runbookId, /^rbk-[a-f0-9-]+$/);
  assert.equal(runbook.title, 'Emergency Offline Recovery Runbook');
  assert.equal(runbook.steps.length, 2);
  assert.equal(runbook.stopConditions.length, 2);
  assert.equal(runbook.rollbackSteps.length, 2);
});

test('2. runbook execution remains manual unless separately authorized (F09)', () => {
  let runbook = createRunbookCard({
    title: 'Deployment Preflight',
    projectId: 'project:dex-pad',
    steps: [
      { stepIndex: 1, title: 'Run lint and type checks', expectedCheck: 'Exit code 0' },
    ],
  });

  assert.equal(runbook.steps[0].executed, false);

  // Manual execution confirmation
  runbook = executeRunbookStep({
    runbook,
    stepIndex: 1,
    operator: 'lead-dev',
    checkResult: 'Exit code 0 confirmed manually',
  });

  assert.equal(runbook.steps[0].executed, true);
  assert.equal(runbook.steps[0].operator, 'lead-dev');
  assert.ok(runbook.steps[0].confirmedAt);
});

test('3. createDeviceSessionContext and restoreDeviceSessionContext handle peer continuation (F10)', () => {
  const session = createDeviceSessionContext({
    deviceId: 'dev-macbook-pro',
    activeProjectId: 'project:dex-pad',
    activeItemId: 'decision:consensus-election',
    scrollOffset: { x: 0, y: 480 },
    syncEpoch: 1,
  });

  assert.equal(session.schemaVersion, 'dex-session-context.v1');
  assert.equal(session.deviceId, 'dev-macbook-pro');
  assert.equal(session.activeItemId, 'decision:consensus-election');

  // Successful restoration when authentic peer synchronization is confirmed
  const resumed = restoreDeviceSessionContext({
    sessionContext: session,
    targetDeviceId: 'dev-phone-android',
    isPeerSynchronized: true,
  });

  assert.equal(resumed.restored, true);
  assert.equal(resumed.activeProjectId, 'project:dex-pad');
  assert.equal(resumed.activeItemId, 'decision:consensus-election');
  assert.deepEqual(resumed.scrollOffset, { x: 0, y: 480 });
});

test('4. restoreDeviceSessionContext strictly rejects restoration without peer sync (F10)', () => {
  const session = createDeviceSessionContext({
    deviceId: 'dev-macbook',
    activeProjectId: 'project:dex-pad',
    activeItemId: 'note:1',
    scrollOffset: { x: 0, y: 100 },
  });

  // Must reject without peer sync
  assert.throws(() => {
    restoreDeviceSessionContext({
      sessionContext: session,
      targetDeviceId: 'dev-phone',
      isPeerSynchronized: false,
    });
  }, { name: 'SessionHandoffError', message: /authentic peer synchronization required/ });
});
