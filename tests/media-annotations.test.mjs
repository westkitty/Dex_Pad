import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createImageRegionAnnotation,
  projectRegionToViewport,
  createTimecodedMediaAnnotation,
  serializeMediaAnnotations,
  deserializeMediaAnnotations,
  MediaAnnotationError,
} from '../src/core/media-annotations.js';

test('1. createImageRegionAnnotation stores normalized coordinates in [0, 1] and preserves source bytes untouched (F12)', () => {
  const annotation = createImageRegionAnnotation({
    sourceAssetId: 'asset:diagram-arch-png',
    targetNoteId: 'note:auth-flow',
    box: { x: 0.25, y: 0.10, width: 0.50, height: 0.35 },
    noteText: 'The token exchange boundary occurs here.',
  });

  assert.equal(annotation.schemaVersion, 'dex-media-annotation.v1');
  assert.match(annotation.annotationId, /^annot-[a-f0-9-]+$/);
  assert.equal(annotation.kind, 'image-region');
  assert.equal(annotation.sourceAssetId, 'asset:diagram-arch-png');
  assert.deepEqual(annotation.box, { x: 0.25, y: 0.10, width: 0.50, height: 0.35 });
  assert.equal(annotation.noteText, 'The token exchange boundary occurs here.');
  assert.ok(annotation.createdAt);
});

test('2. projectRegionToViewport accurately projects normalized coordinates across varied device sizes (F12)', () => {
  const annotation = createImageRegionAnnotation({
    sourceAssetId: 'asset:mockup-png',
    targetNoteId: 'note:button-pos',
    box: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
    noteText: 'Primary CTA button position',
  });

  // Mobile viewport: 390 x 844
  const mobile = projectRegionToViewport({ annotation, viewportWidth: 390, viewportHeight: 844 });
  assert.equal(mobile.pixelX, 39);
  assert.equal(mobile.pixelY, 168.8);
  assert.equal(mobile.pixelWidth, 117);
  assert.equal(mobile.pixelHeight, 337.6);

  // Desktop viewport: 1920 x 1080
  const desktop = projectRegionToViewport({ annotation, viewportWidth: 1920, viewportHeight: 1080 });
  assert.equal(desktop.pixelX, 192);
  assert.equal(desktop.pixelY, 216);
  assert.equal(desktop.pixelWidth, 576);
  assert.equal(desktop.pixelHeight, 432);
});

test('3. createTimecodedMediaAnnotation captures timestamp and survives export (F13)', () => {
  const annotation = createTimecodedMediaAnnotation({
    mediaAssetId: 'asset:meeting-recording-mp4',
    targetNoteId: 'note:key-agreement',
    timestampSeconds: 142.5,
    durationSeconds: 15.0,
    label: 'Key agreement discussion',
    noteText: 'Team agreed to zero external package runtime invariant.',
  });

  assert.equal(annotation.schemaVersion, 'dex-media-annotation.v1');
  assert.equal(annotation.kind, 'timecoded-media');
  assert.equal(annotation.timestampSeconds, 142.5);
  assert.equal(annotation.durationSeconds, 15.0);
  assert.equal(annotation.label, 'Key agreement discussion');

  // Serialization roundtrip for export
  const exported = serializeMediaAnnotations([annotation]);
  const imported = deserializeMediaAnnotations(exported);

  assert.equal(imported.length, 1);
  assert.deepEqual(imported[0], annotation);
});

test('4. rejects invalid normalized coordinates with MediaAnnotationError', () => {
  assert.throws(() => {
    createImageRegionAnnotation({
      sourceAssetId: 'asset:1',
      targetNoteId: 'note:1',
      box: { x: -0.1, y: 0.2, width: 0.3, height: 0.3 }, // x < 0
    });
  }, { name: 'MediaAnnotationError', message: /out of normalized \[0, 1\] range/ });

  assert.throws(() => {
    createImageRegionAnnotation({
      sourceAssetId: 'asset:1',
      targetNoteId: 'note:1',
      box: { x: 0.8, y: 0.2, width: 0.5, height: 0.3 }, // x + width > 1
    });
  }, { name: 'MediaAnnotationError', message: /exceeds maximum coordinate 1/ });
});
