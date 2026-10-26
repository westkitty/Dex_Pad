const SCHEMAS = new Set(['dex-relay.event.v1', 'dex-relay.task.v1']);

const STAGES = new Set([
  'PREPARED',
  'CLAUDE_DONE',
  'CODEX_CLAIMED',
  'CODEX_DONE',
  'VERIFIED',
  'BLOCKED',
  'AMBIGUOUS',
  'CANCELLED',
]);

const ACTIONS = new Set([
  'CLAUDE_COMPLETED',
  'CODEX_CLAIMED',
  'CODEX_COMPLETED',
  'VERIFICATION_PASSED',
  'BLOCKED',
  'MARK_AMBIGUOUS',
  'CANCELLED',
]);

const HASH_REGEX = /^[0-9a-f]{64}$/;
const ID_REGEX = /^[a-zA-Z0-9_-]+$/;
const SENSITIVE_KEYS = new Set([
  'secret', 'privatekey', 'vaultkey', 'token', 'password',
  'prompt', 'rawlog', 'command', 'exec', 'script', 'credentials'
]);
const MAX_PAYLOAD_BYTES = 65_536; // 64 KB

export class RelayError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RelayError';
  }
}

function fail(msg) {
  throw new RelayError(msg);
}

function checkHash(val, fieldName, nullable = false) {
  if (nullable && val === null) return null;
  if (typeof val !== 'string' || !HASH_REGEX.test(val)) {
    fail(`Invalid hash syntax for ${fieldName}: expected 64-character lowercase hex`);
  }
  return val;
}

function checkId(val, fieldName, min = 4, max = 120) {
  if (typeof val !== 'string' || val.length < min || val.length > max || !ID_REGEX.test(val)) {
    fail(`Invalid identifier for ${fieldName}: must be ${min}-${max} alphanumeric/dash/underscore chars`);
  }
  return val;
}

export function sanitizePayload(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const cleaned = {};
  for (const [key, val] of Object.entries(raw)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) continue;
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean' || val === null) {
      cleaned[key] = val;
    } else if (Array.isArray(val)) {
      cleaned[key] = val.filter(v => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean');
    } else if (typeof val === 'object') {
      cleaned[key] = sanitizePayload(val);
    }
  }
  return cleaned;
}

export function validateRelayEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    fail('Event must be an object');
  }

  // Schema Version
  if (!SCHEMAS.has(event.schemaVersion)) {
    fail(`Unsupported schema: ${event.schemaVersion}`);
  }

  // Identifiers
  const eventId = checkId(event.eventId, 'eventId', 4, 120);
  const taskId = checkId(event.taskId, 'taskId', 4, 120);
  const correlationId = checkId(event.correlationId, 'correlationId', 4, 120);
  const sourceNodeId = checkId(event.sourceNodeId, 'sourceNodeId', 2, 120);
  const targetNodeId = checkId(event.targetNodeId, 'targetNodeId', 2, 120);
  const idempotencyKey = checkId(event.idempotencyKey, 'idempotencyKey', 4, 120);

  // Sequence
  if (!Number.isInteger(event.sequence) || event.sequence < 1) {
    fail('Sequence must be a positive integer >= 1');
  }

  // Hashes
  const previousEventHash = event.sequence === 1 && event.previousEventHash === null
    ? null
    : checkHash(event.previousEventHash, 'previousEventHash', event.sequence === 1);
  const eventHash = checkHash(event.eventHash, 'eventHash');
  const receiptHash = event.receiptHash ? checkHash(event.receiptHash, 'receiptHash') : null;
  const resultHash = event.resultHash ? checkHash(event.resultHash, 'resultHash') : null;

  // Actions and Stages
  if (!ACTIONS.has(event.action)) {
    fail(`Unsupported event action: ${event.action}`);
  }
  if (!STAGES.has(event.stage)) {
    fail(`Unsupported stage name: ${event.stage}`);
  }

  // Timestamp
  if (typeof event.atUtc !== 'string' || !Number.isFinite(new Date(event.atUtc).getTime())) {
    fail('Invalid atUtc timestamp: must be valid ISO 8601');
  }

  // Payload Size and Sanitization
  let serialized = '';
  try {
    serialized = JSON.stringify(event.payload ?? {});
  } catch {
    fail('Malformed payload object');
  }
  const payloadBytes = typeof Buffer !== 'undefined'
    ? Buffer.byteLength(serialized, 'utf8')
    : new TextEncoder().encode(serialized).length;
  if (payloadBytes > MAX_PAYLOAD_BYTES) {
    fail('Payload exceeds maximum size of 64KB');
  }

  const sanitized = sanitizePayload(event.payload);

  return {
    schemaVersion: event.schemaVersion,
    eventId,
    taskId,
    correlationId,
    sourceNodeId,
    targetNodeId,
    idempotencyKey,
    sequence: event.sequence,
    previousEventHash,
    eventHash,
    receiptHash,
    resultHash,
    action: event.action,
    stage: event.stage,
    atUtc: event.atUtc,
    payload: sanitized,
  };
}
