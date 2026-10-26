/**
 * Procedural micro-acoustic feedback engine for DEX//Pad terminal apparatus.
 * Zero external audio files; pure mathematical Web Audio synthesis.
 * Gracefully degrades to silent no-op in headless, Node, or unsupported runtimes.
 */
export function createAcousticFeedback() {
  let ctx = null;
  let muted = false;

  function getContext() {
    if (muted) return null;
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;

    if (!ctx) {
      try {
        ctx = new AudioCtx();
      } catch {
        ctx = null;
      }
    }
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  return {
    isMuted() {
      return muted;
    },

    setMuted(val) {
      muted = Boolean(val);
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem('dexpad_audio_muted', muted ? '1' : '0');
        }
      } catch {}
    },

    /**
     * Subtle mechanical tick for tactile interactions.
     */
    tick() {
      const c = getContext();
      if (!c) return;
      try {
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1400, c.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, c.currentTime + 0.008);

        gain.gain.setValueAtTime(0.04, c.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.008);

        osc.connect(gain);
        gain.connect(c.destination);

        osc.start(c.currentTime);
        osc.stop(c.currentTime + 0.008);
      } catch {}
    },

    /**
     * Resonant magnetic impulse for durable local commits.
     */
    commit() {
      const c = getContext();
      if (!c) return;
      try {
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(180, c.currentTime);
        osc.frequency.exponentialRampToValueAtTime(65, c.currentTime + 0.08);

        gain.gain.setValueAtTime(0.08, c.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.08);

        osc.connect(gain);
        gain.connect(c.destination);

        osc.start(c.currentTime);
        osc.stop(c.currentTime + 0.08);
      } catch {}
    },

    /**
     * Dual-tone harmonic chime for peer acknowledgment.
     */
    peerAck() {
      const c = getContext();
      if (!c) return;
      try {
        const now = c.currentTime;
        const freqs = [880, 1320];
        for (const f of freqs) {
          const osc = c.createOscillator();
          const gain = c.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, now);

          gain.gain.setValueAtTime(0.03, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

          osc.connect(gain);
          gain.connect(c.destination);

          osc.start(now);
          osc.stop(now + 0.12);
        }
      } catch {}
    },

    /**
     * Muted amber alert pulse for drift or warning.
     */
    alert() {
      const c = getContext();
      if (!c) return;
      try {
        const now = c.currentTime;
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.06);

        gain.gain.setValueAtTime(0.03, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

        osc.connect(gain);
        gain.connect(c.destination);

        osc.start(now);
        osc.stop(now + 0.06);
      } catch {}
    },
  };
}
