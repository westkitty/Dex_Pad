export class RunbookError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RunbookError';
  }
}

export class SessionHandoffError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SessionHandoffError';
  }
}

/**
 * Creates an Interactive Runbook Card (F09).
 * Crucial invariant: Execution remains manual unless separately authorized.
 */
export function createRunbookCard({
  title,
  projectId = null,
  steps = [],
  stopConditions = [],
  rollbackSteps = [],
} = {}) {
  if (!title || typeof title !== 'string') {
    throw new RunbookError('title is required');
  }

  const cleanSteps = Array.isArray(steps)
    ? steps.map((s, idx) => ({
        stepIndex: typeof s.stepIndex === 'number' ? s.stepIndex : idx + 1,
        title: String(s.title || `Step ${idx + 1}`).trim(),
        expectedCheck: String(s.expectedCheck || '').trim(),
        commandOrAction: s.commandOrAction ? String(s.commandOrAction).trim() : null,
        executed: false,
        operator: null,
        checkResult: null,
        confirmedAt: null,
      }))
    : [];

  return {
    schemaVersion: 'dex-runbook.v1',
    runbookId: `rbk-${crypto.randomUUID()}`,
    title: title.trim(),
    projectId: projectId ? String(projectId).trim() : null,
    steps: cleanSteps,
    stopConditions: Array.isArray(stopConditions) ? [...stopConditions] : [],
    rollbackSteps: Array.isArray(rollbackSteps) ? [...rollbackSteps] : [],
    createdAt: new Date().toISOString(),
  };
}

/**
 * Records manual confirmation of a runbook step execution (F09).
 */
export function executeRunbookStep({
  runbook,
  stepIndex,
  operator = 'human-operator',
  checkResult = '',
} = {}) {
  if (!runbook || !runbook.runbookId || !Array.isArray(runbook.steps)) {
    throw new RunbookError('Valid runbook is required');
  }

  const targetStep = runbook.steps.find(s => s.stepIndex === stepIndex);
  if (!targetStep) {
    throw new RunbookError(`Step index ${stepIndex} not found in runbook`);
  }

  const updatedSteps = runbook.steps.map(s => {
    if (s.stepIndex === stepIndex) {
      return {
        ...s,
        executed: true,
        operator: String(operator).trim(),
        checkResult: String(checkResult || 'Manual confirmation').trim(),
        confirmedAt: new Date().toISOString(),
      };
    }
    return s;
  });

  return {
    ...runbook,
    steps: updatedSteps,
  };
}

/**
 * Creates portable device session state for peer continuation (F10).
 */
export function createDeviceSessionContext({
  deviceId,
  activeProjectId = null,
  activeItemId = null,
  scrollOffset = { x: 0, y: 0 },
  syncEpoch = 1,
} = {}) {
  if (!deviceId || typeof deviceId !== 'string') {
    throw new SessionHandoffError('deviceId is required');
  }

  return {
    schemaVersion: 'dex-session-context.v1',
    sessionId: `sess-${crypto.randomUUID()}`,
    deviceId: deviceId.trim(),
    activeProjectId: activeProjectId ? String(activeProjectId).trim() : null,
    activeItemId: activeItemId ? String(activeItemId).trim() : null,
    scrollOffset: {
      x: Number(scrollOffset.x || 0),
      y: Number(scrollOffset.y || 0),
    },
    syncEpoch: Number(syncEpoch || 1),
    capturedAt: new Date().toISOString(),
  };
}

/**
 * Restores session context on another device (F10).
 * Crucial invariant: A second trusted device reopens the same project/item
 * and scroll context only after authentic peer synchronization.
 */
export function restoreDeviceSessionContext({
  sessionContext,
  targetDeviceId,
  isPeerSynchronized = false,
} = {}) {
  if (!sessionContext || !sessionContext.sessionId) {
    throw new SessionHandoffError('Valid sessionContext is required');
  }
  if (!targetDeviceId || typeof targetDeviceId !== 'string') {
    throw new SessionHandoffError('targetDeviceId is required');
  }

  if (!isPeerSynchronized) {
    throw new SessionHandoffError(
      'Cannot resume session context on target device: authentic peer synchronization required'
    );
  }

  return {
    restored: true,
    targetDeviceId: targetDeviceId.trim(),
    activeProjectId: sessionContext.activeProjectId,
    activeItemId: sessionContext.activeItemId,
    scrollOffset: structuredClone(sessionContext.scrollOffset),
    resumedAt: new Date().toISOString(),
  };
}
