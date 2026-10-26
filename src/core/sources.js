export class SourceLedgerError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SourceLedgerError';
  }
}

export const AUTHORITY_LABELS = new Set([
  'primary-specification',
  'reference-implementation',
  'external-doc',
  'unverified-source',
  'internal-draft',
]);

/**
 * Pure-JS synchronous SHA-256 for zero-dependency portability across Node & Browser runtimes.
 */
function sha256Internal(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const lengthProperty = 'length';
  let i, j;
  let result = '';
  const words = [];
  const asciiBitLength = ascii[lengthProperty] * 8;
  let hash = [];
  const k = [];
  let primeCounter = 0;
  const isComposite = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) isComposite[i] = candidate;
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  hash = hash.slice(0, 8);
  ascii += '\x80';
  while (ascii[lengthProperty] % 64 - 56) ascii += '\x00';
  for (i = 0; i < ascii[lengthProperty]; i++) {
    j = ascii.charCodeAt(i);
    words[i >> 2] |= j << ((3 - (i % 4)) * 8);
  }
  words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
  words[words[lengthProperty]] = asciiBitLength | 0;
  for (j = 0; j < words[lengthProperty]; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash;
    hash = hash.slice(0, 8);
    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15], w2 = w[i - 2];
      const a = hash[0], e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
    }
    for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
  }
  for (i = 0; i < 8; i++) {
    for (j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

export function computeSha256(input) {
  const bytes = new TextEncoder().encode(input ?? '');
  let ascii = '';
  for (let i = 0; i < bytes.length; i++) ascii += String.fromCharCode(bytes[i]);
  return sha256Internal(ascii);
}

/**
 * Creates an immutable record in the Original-Source Ledger (C12).
 */
export function createSourceRecord({
  uri,
  title,
  contentSnapshot,
  authorityLabel = 'primary-specification',
  metadata = {},
  fileHash,
} = {}) {
  if (!uri || typeof uri !== 'string' || !uri.trim()) {
    throw new SourceLedgerError('URI is required and must be a non-empty string');
  }
  if (!AUTHORITY_LABELS.has(authorityLabel)) {
    throw new SourceLedgerError(`Unsupported authority label: ${authorityLabel}`);
  }

  const cleanUri = uri.trim();
  const cleanTitle = (title || cleanUri).trim();
  const snapshot = contentSnapshot != null ? String(contentSnapshot) : '';
  const hash = fileHash || computeSha256(snapshot || cleanUri);

  return {
    schemaVersion: 'dex-source.v1',
    sourceId: `src-${crypto.randomUUID()}`,
    uri: cleanUri,
    title: cleanTitle,
    fileHash: hash,
    capturedAt: new Date().toISOString(),
    authorityLabel,
    contentSnapshot: snapshot,
    metadata: structuredClone(metadata),
    derivedRecordIds: [],
  };
}

/**
 * Links a DEX//Pad item ID to a source record, preserving derived provenance (C12).
 */
export function linkDerivedRecord({ source, recordId }) {
  if (!source || typeof source !== 'object' || !source.sourceId) {
    throw new SourceLedgerError('Valid source record is required');
  }
  if (!recordId || typeof recordId !== 'string') {
    throw new SourceLedgerError('recordId is required');
  }

  const existing = new Set(source.derivedRecordIds || []);
  existing.add(recordId.trim());

  return {
    ...source,
    derivedRecordIds: Array.from(existing),
  };
}

/**
 * Creates a Deep Citation Anchor (F11) with line/section coordinates and snapshot hash.
 */
export function createCitationAnchor({
  source,
  targetItemId,
  anchor,
  exactQuote,
} = {}) {
  if (!source || !source.sourceId) {
    throw new SourceLedgerError('source is required and must have a sourceId');
  }
  if (!targetItemId || typeof targetItemId !== 'string') {
    throw new SourceLedgerError('targetItemId is required');
  }
  if (!anchor || typeof anchor !== 'object' || !anchor.type) {
    throw new SourceLedgerError('anchor object with type is required');
  }
  if (typeof exactQuote !== 'string' || !exactQuote.trim()) {
    throw new SourceLedgerError('exactQuote must be a non-empty string');
  }

  const quote = exactQuote.trim();
  const snapshotHash = computeSha256(quote);

  return {
    schemaVersion: 'dex-citation.v1',
    citationId: `cite-${crypto.randomUUID()}`,
    sourceId: source.sourceId,
    targetItemId: targetItemId.trim(),
    anchor: structuredClone(anchor),
    exactQuote: quote,
    snapshotHash,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Verifies a citation against a current source snapshot, detecting stale targets (F11).
 */
export function verifyCitationAnchor({ citation, currentSourceSnapshot }) {
  if (!citation || !citation.snapshotHash || !citation.exactQuote) {
    throw new SourceLedgerError('Valid citation record is required');
  }
  if (typeof currentSourceSnapshot !== 'string') {
    return {
      status: 'STALE',
      driftDetected: true,
      reason: 'Current source snapshot is unavailable or empty',
    };
  }

  if (!currentSourceSnapshot.includes(citation.exactQuote)) {
    return {
      status: 'STALE',
      driftDetected: true,
      reason: 'Quoted target text drifted or was modified in source snapshot',
    };
  }

  return {
    status: 'VALID',
    driftDetected: false,
    reason: 'Citation matches source snapshot',
  };
}
