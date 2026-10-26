export class MediaAnnotationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MediaAnnotationError';
  }
}

/**
 * Creates an Image Region Note (F12) using normalized coordinates in [0, 1].
 * Preserves original source image bytes completely untouched.
 */
export function createImageRegionAnnotation({
  sourceAssetId,
  targetNoteId,
  box,
  noteText = '',
} = {}) {
  if (!sourceAssetId || typeof sourceAssetId !== 'string') {
    throw new MediaAnnotationError('sourceAssetId is required');
  }
  if (!targetNoteId || typeof targetNoteId !== 'string') {
    throw new MediaAnnotationError('targetNoteId is required');
  }
  if (!box || typeof box !== 'object') {
    throw new MediaAnnotationError('box coordinate object is required');
  }

  const { x, y, width, height } = box;
  if (
    typeof x !== 'number' || typeof y !== 'number' ||
    typeof width !== 'number' || typeof height !== 'number' ||
    x < 0 || y < 0 || width <= 0 || height <= 0 ||
    x > 1 || y > 1
  ) {
    throw new MediaAnnotationError('Box coordinates are out of normalized [0, 1] range');
  }

  if (x + width > 1.0001 || y + height > 1.0001) {
    throw new MediaAnnotationError('Box bounds exceeds maximum coordinate 1');
  }

  return {
    schemaVersion: 'dex-media-annotation.v1',
    annotationId: `annot-${crypto.randomUUID()}`,
    kind: 'image-region',
    sourceAssetId: sourceAssetId.trim(),
    targetNoteId: targetNoteId.trim(),
    box: {
      x: Number(x),
      y: Number(y),
      width: Number(width),
      height: Number(height),
    },
    noteText: String(noteText || '').trim(),
    createdAt: new Date().toISOString(),
  };
}

/**
 * Projects normalized [0, 1] region coordinates to a rendered display viewport (F12).
 */
export function projectRegionToViewport({
  annotation,
  viewportWidth,
  viewportHeight,
} = {}) {
  if (!annotation || !annotation.box) {
    throw new MediaAnnotationError('Valid annotation is required');
  }
  if (typeof viewportWidth !== 'number' || typeof viewportHeight !== 'number' || viewportWidth <= 0 || viewportHeight <= 0) {
    throw new MediaAnnotationError('Valid viewportWidth and viewportHeight are required');
  }

  return {
    pixelX: Number((annotation.box.x * viewportWidth).toFixed(2)),
    pixelY: Number((annotation.box.y * viewportHeight).toFixed(2)),
    pixelWidth: Number((annotation.box.width * viewportWidth).toFixed(2)),
    pixelHeight: Number((annotation.box.height * viewportHeight).toFixed(2)),
  };
}

/**
 * Creates a Timecoded Media Note (F13) linking a timestamp in seconds to a note.
 */
export function createTimecodedMediaAnnotation({
  mediaAssetId,
  targetNoteId,
  timestampSeconds,
  durationSeconds = null,
  label = '',
  noteText = '',
} = {}) {
  if (!mediaAssetId || typeof mediaAssetId !== 'string') {
    throw new MediaAnnotationError('mediaAssetId is required');
  }
  if (!targetNoteId || typeof targetNoteId !== 'string') {
    throw new MediaAnnotationError('targetNoteId is required');
  }
  if (typeof timestampSeconds !== 'number' || timestampSeconds < 0 || Number.isNaN(timestampSeconds)) {
    throw new MediaAnnotationError('timestampSeconds must be a non-negative number');
  }

  return {
    schemaVersion: 'dex-media-annotation.v1',
    annotationId: `annot-${crypto.randomUUID()}`,
    kind: 'timecoded-media',
    mediaAssetId: mediaAssetId.trim(),
    targetNoteId: targetNoteId.trim(),
    timestampSeconds: Number(timestampSeconds),
    durationSeconds: durationSeconds != null ? Number(durationSeconds) : null,
    label: String(label || '').trim(),
    noteText: String(noteText || '').trim(),
    createdAt: new Date().toISOString(),
  };
}

/**
 * Serializes media annotations for portable export (survives export invariant).
 */
export function serializeMediaAnnotations(annotations = []) {
  return JSON.stringify(annotations, null, 2);
}

/**
 * Deserializes and validates media annotations from export data.
 */
export function deserializeMediaAnnotations(jsonStr) {
  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) throw new Error('Expected array');
    return parsed;
  } catch (error) {
    throw new MediaAnnotationError(`Invalid media annotation archive: ${error.message}`);
  }
}
