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

    /**
     * Ultra-short dry rotary detent tick for chronological timeline scrubbing.
     */
    scrub() {
      const c = getContext();
      if (!c) return;
      try {
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(2200, c.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, c.currentTime + 0.003);

        gain.gain.setValueAtTime(0.025, c.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.003);

        osc.connect(gain);
        gain.connect(c.destination);

        osc.start(c.currentTime);
        osc.stop(c.currentTime + 0.003);
      } catch {}
    },

    /**
     * Dual-stage mechanical aperture shutter for major lens transitions.
     */
    shutter() {
      const c = getContext();
      if (!c) return;
      try {
        const now = c.currentTime;
        // First latch
        const osc1 = c.createOscillator();
        const gain1 = c.createGain();
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(950, now);
        osc1.frequency.exponentialRampToValueAtTime(400, now + 0.006);
        gain1.gain.setValueAtTime(0.04, now);
        gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.006);
        osc1.connect(gain1);
        gain1.connect(c.destination);
        osc1.start(now);
        osc1.stop(now + 0.006);

        // Second release
        const osc2 = c.createOscillator();
        const gain2 = c.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(1600, now + 0.025);
        osc2.frequency.exponentialRampToValueAtTime(600, now + 0.033);
        gain2.gain.setValueAtTime(0.03, now + 0.025);
        gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.033);
        osc2.connect(gain2);
        gain2.connect(c.destination);
        osc2.start(now + 0.025);
        osc2.stop(now + 0.033);
      } catch {}
    },
  };
}
