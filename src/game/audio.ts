// Procedural Web Audio Synthesizer for Tactile Block Puzzle Feedback

class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;

  constructor() {
    try {
      const saved = localStorage.getItem('blokblast_muted');
      if (saved === '1') this.muted = true;
    } catch {
      // ignore storage errors
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (
      typeof navigator !== 'undefined' &&
      (navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent))
    ) {
      return null;
    }
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
    try {
      localStorage.setItem('blokblast_muted', mute ? '1' : '0');
    } catch {
      // ignore
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    if (!this.muted) {
      this.playPickup();
    }
    return this.muted;
  }

  private jitter(baseFreq: number, pct = 0.06): number {
    return baseFreq * (1 + (Math.random() * 2 - 1) * pct);
  }

  public playPickup(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const freq = this.jitter(360, 0.08);
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.38, now + 0.065);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  public playGridSnap(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const freq = this.jitter(520, 0.04);
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.024);

    gain.gain.setValueAtTime(0.045, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.026);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.03);
  }

  public playPlace(cellCount: number): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Tactile low-mid thud + ceramic click
    const osc = ctx.createOscillator();
    const clickOsc = ctx.createOscillator();
    const gain = ctx.createGain();
    const clickGain = ctx.createGain();

    osc.type = 'sine';
    const base = Math.max(150, 240 - cellCount * 8);
    osc.frequency.setValueAtTime(this.jitter(base, 0.05), now);
    osc.frequency.exponentialRampToValueAtTime(78, now + 0.11);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(this.jitter(680, 0.06), now);
    clickOsc.frequency.exponentialRampToValueAtTime(320, now + 0.045);

    clickGain.gain.setValueAtTime(0.09, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    clickOsc.connect(clickGain);
    gain.connect(ctx.destination);
    clickGain.connect(ctx.destination);

    osc.start(now);
    clickOsc.start(now);
    osc.stop(now + 0.13);
    clickOsc.stop(now + 0.055);
  }

  public playLineClear(lines: number, combo: number, isAllClear = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Pentatonic major scale intervals shifted up by combo
    const pentatonic = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0];
    const startIdx = Math.min(combo, 4);
    const noteCount = Math.min(3 + lines, 6);

    for (let i = 0; i < noteCount; i++) {
      const noteTime = now + i * 0.052;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = lines >= 2 || isAllClear ? 'triangle' : 'sine';
      const freq = pentatonic[(startIdx + i) % pentatonic.length] * (combo > 4 ? 1.25 : 1);
      osc.frequency.setValueAtTime(freq, noteTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.02, noteTime + 0.24);

      gain.gain.setValueAtTime(0.001, noteTime);
      gain.gain.linearRampToValueAtTime(0.18, noteTime + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(noteTime);
      osc.stop(noteTime + 0.3);
    }

    // Sub-bass punch for heavy multi-line or combo blasts
    if (lines >= 2 || combo >= 2 || isAllClear) {
      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(130, now);
      sub.frequency.exponentialRampToValueAtTime(42, now + 0.26);

      subGain.gain.setValueAtTime(0.28, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      sub.connect(subGain);
      subGain.connect(ctx.destination);
      sub.start(now);
      sub.stop(now + 0.29);
    }
  }

  public playInvalid(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const t = now + i * 0.065;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(145 - i * 20, t);

      gain.gain.setValueAtTime(0.07, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.055);
    }
  }

  public playVictory(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.09;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.42);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.45);
    });
  }

  public playGameOver(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [392.0, 349.23, 311.13, 261.63];
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.11;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.16, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.36);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.38);
    });
  }
}

export const soundEngine = new SoundEngine();
