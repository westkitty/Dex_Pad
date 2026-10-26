import test from 'node:test';
import assert from 'node:assert/strict';
import { createAcousticFeedback } from '../src/ui/audio.js';

test('1. createAcousticFeedback gracefully degrades in headless or unsupported environments', () => {
  const audio = createAcousticFeedback();

  assert.equal(typeof audio.tick, 'function');
  assert.equal(typeof audio.commit, 'function');
  assert.equal(typeof audio.peerAck, 'function');
  assert.equal(typeof audio.alert, 'function');
  assert.equal(typeof audio.setMuted, 'function');
  assert.equal(typeof audio.isMuted, 'function');

  // Must not throw when called in non-browser Node runtime
  assert.doesNotThrow(() => {
    audio.tick();
    audio.commit();
    audio.peerAck();
    audio.alert();
  });
});

test('2. mute state toggles cleanly and survives inspection', () => {
  const audio = createAcousticFeedback();
  assert.equal(audio.isMuted(), false);

  audio.setMuted(true);
  assert.equal(audio.isMuted(), true);

  audio.setMuted(false);
  assert.equal(audio.isMuted(), false);
});
