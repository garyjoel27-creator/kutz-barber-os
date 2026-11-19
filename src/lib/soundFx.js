/**
 * Procedural Web Audio API Sound Synthesis Engine & Mobile Haptics
 * Zero external assets (0 KB network), 0ms latency, 100% offline PWA compatible.
 */

class SoundFXEngine {
  constructor() {
    this.ctx = null;
  }

  /**
   * Initializes or resumes the AudioContext on user gesture.
   * Recovers safely from closed/zombie states and guards constructor failures.
   */
  init() {
    if ((!this.ctx || this.ctx.state === 'closed') && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        try {
          this.ctx = new AudioCtx();
        } catch {
          this.ctx = null;
        }
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  /**
   * Safe wrapper for navigator.vibrate with mobile device support check.
   * @param {number} duration - Vibration duration in milliseconds (default 10ms)
   */
  triggerHaptic(duration = 10) {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(duration);
      }
    } catch {
      // Graceful fallback on restricted or unsupported environments
    }
  }

  /**
   * 3D Card Flip Swoosh:
   * Dual sine + triangle oscillator sweep (180Hz -> 320Hz, 120ms duration)
   * with lowpass acoustic filter and exponential gain decay.
   */
  playFlip() {
    try {
      this.init();
      if (!this.ctx) return;

      const t0 = this.ctx.currentTime;
      const duration = 0.12; // 120ms

      const oscSine = this.ctx.createOscillator();
      const oscTri = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      // Sine wave for smooth body, triangle for crisp mechanical presence
      oscSine.type = 'sine';
      oscTri.type = 'triangle';

      oscSine.frequency.setValueAtTime(180, t0);
      oscSine.frequency.exponentialRampToValueAtTime(320, t0 + duration);

      oscTri.frequency.setValueAtTime(180, t0);
      oscTri.frequency.exponentialRampToValueAtTime(320, t0 + duration);

      // Warm lowpass filter to emulate physical card rotation in air
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(850, t0);
      filter.frequency.linearRampToValueAtTime(1200, t0 + duration);

      gainNode.gain.setValueAtTime(0.08, t0);
      gainNode.gain.exponentialRampToValueAtTime(0.001, t0 + duration);

      oscSine.connect(filter);
      oscTri.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      oscSine.start(t0);
      oscTri.start(t0);
      oscSine.stop(t0 + duration);
      oscTri.stop(t0 + duration);

      this.triggerHaptic(12);
    } catch {
      // Graceful silence if audio permissions or platform restrictions apply
    }
  }

  /**
   * Sharp Mechanical Click:
   * Transient tick pulse (600Hz -> 200Hz, 30ms duration) with exponential decay.
   */
  playClick() {
    try {
      this.init();
      if (!this.ctx) return;

      const t0 = this.ctx.currentTime;
      const duration = 0.03; // 30ms

      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, t0);
      osc.frequency.exponentialRampToValueAtTime(200, t0 + duration);

      gainNode.gain.setValueAtTime(0.05, t0);
      gainNode.gain.exponentialRampToValueAtTime(0.001, t0 + duration);

      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      osc.start(t0);
      osc.stop(t0 + duration);

      this.triggerHaptic(8);
    } catch {
      // Graceful silence
    }
  }
}

export const soundFx = new SoundFXEngine();
export const triggerHaptic = (duration = 10) => soundFx.triggerHaptic(duration);
export const playFlip = () => soundFx.playFlip();
export const playClick = () => soundFx.playClick();

export default soundFx;
