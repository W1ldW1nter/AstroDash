/**
 * Tiny WebAudio synth shared by sound effects and music. Everything is
 * generated in code (oscillators + a noise buffer), so the game ships no audio files.
 *
 * Browsers only allow audio after a user gesture, so the context is created
 * lazily by `unlock()` (called on the first key press / click).
 */

export type Wave = 'square' | 'triangle' | 'sine' | 'sawtooth' | 'pulse25' | 'pulse12';

const STORAGE_KEY = 'astrodash.audio.v1';
const MASTER_VOL = 0.8;
const SFX_VOL = 0.55;
const MUSIC_VOL = 0.32;

export interface ToneOptions {
  wave: Wave;
  freq: number;
  /** Slide to this frequency over the note. */
  to?: number;
  dur: number;
  vol: number;
  /** Seconds from now (or absolute context time when `abs` is set). */
  at?: number;
  abs?: boolean;
  attack?: number;
  /** 'pluck' decays over the whole note; 'hold' sustains then releases at the end. */
  env?: 'pluck' | 'hold';
  bus?: AudioNode;
}

export interface NoiseOptions {
  dur: number;
  vol: number;
  at?: number;
  abs?: boolean;
  filter?: BiquadFilterType;
  freq?: number;
  /** Sweep the filter to this frequency. */
  to?: number;
  q?: number;
  bus?: AudioNode;
}

class AudioEngine {
  ctx: AudioContext | null = null;
  sfxBus!: GainNode;
  musicBus!: GainNode;
  private master!: GainNode;
  private noiseBuf!: AudioBuffer;
  private waves: Partial<Record<Wave, PeriodicWave>> = {};
  private readyCallbacks: (() => void)[] = [];
  private background = false;
  muted = false;

  constructor() {
    try {
      this.muted = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').muted === true;
    } catch {
      this.muted = false;
    }
  }

  /** True once the context exists and is producing sound. */
  get running(): boolean {
    return this.ctx?.state === 'running';
  }

  /** Create / resume the audio context. Must be called from a user gesture the first time. */
  unlock(): void {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return; // no WebAudio: the game just runs silent
      }
      this.build(this.ctx);
    }
    if (this.ctx.state === 'suspended' && !this.background) void this.ctx.resume();
    if (this.readyCallbacks.length) {
      const cbs = this.readyCallbacks;
      this.readyCallbacks = [];
      for (const cb of cbs) cb();
    }
  }

  /** Run `cb` now if the context exists, otherwise as soon as it's unlocked. */
  whenReady(cb: () => void): void {
    if (this.ctx) cb();
    else this.readyCallbacks.push(cb);
  }

  /** Window lost / regained focus: freeze all sound (music timing included). */
  setBackground(bg: boolean): void {
    this.background = bg;
    if (!this.ctx) return;
    if (bg) void this.ctx.suspend();
    else void this.ctx.resume();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ muted: this.muted }));
    } catch {
      /* storage blocked: mute just isn't remembered */
    }
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : MASTER_VOL, this.ctx.currentTime, 0.02);
    return this.muted;
  }

  // ------------------------------------------------------------- voices

  tone(o: ToneOptions): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = o.abs ? (o.at ?? ctx.currentTime) : ctx.currentTime + (o.at ?? 0);
    const end = t0 + o.dur;
    const osc = ctx.createOscillator();
    const pw = this.periodicWave(o.wave);
    if (pw) osc.setPeriodicWave(pw);
    else osc.type = o.wave as OscillatorType;
    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), end);

    const g = ctx.createGain();
    const attack = o.attack ?? 0.004;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(o.vol, t0 + attack);
    if (o.env === 'hold') {
      const rel = Math.min(0.05, o.dur * 0.3);
      g.gain.setValueAtTime(o.vol * 0.8, Math.max(t0 + attack, end - rel));
      g.gain.linearRampToValueAtTime(0, end);
    } else {
      g.gain.exponentialRampToValueAtTime(0.0001, end);
    }
    osc.connect(g).connect(o.bus ?? this.sfxBus);
    osc.start(t0);
    osc.stop(end + 0.02);
  }

  noise(o: NoiseOptions): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = o.abs ? (o.at ?? ctx.currentTime) : ctx.currentTime + (o.at ?? 0);
    const end = t0 + o.dur;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    // Start at a random point so repeated bursts don't sound identical.
    const offset = Math.random() * (this.noiseBuf.duration - 0.1);

    const f = ctx.createBiquadFilter();
    f.type = o.filter ?? 'lowpass';
    f.frequency.setValueAtTime(o.freq ?? 4000, t0);
    if (o.to !== undefined) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), end);
    f.Q.value = o.q ?? 0.7;

    const g = ctx.createGain();
    g.gain.setValueAtTime(o.vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    src.connect(f).connect(g).connect(o.bus ?? this.sfxBus);
    src.start(t0, offset);
    src.stop(end + 0.02);
  }

  // ----------------------------------------------------------- internals

  private build(ctx: AudioContext): void {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 4;
    comp.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : MASTER_VOL;
    this.master.connect(comp);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = SFX_VOL;
    this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = MUSIC_VOL;
    this.musicBus.connect(this.master);

    // 2 s of white noise, reused by every noise voice.
    this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  /** Narrow pulse waves (the classic chiptune timbres) built from their Fourier series. */
  private periodicWave(w: Wave): PeriodicWave | null {
    if (w !== 'pulse25' && w !== 'pulse12') return null;
    const cached = this.waves[w];
    if (cached) return cached;
    const duty = w === 'pulse25' ? 0.25 : 0.125;
    const n = 32;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let k = 1; k < n; k++) real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
    const pw = this.ctx!.createPeriodicWave(real, imag);
    this.waves[w] = pw;
    return pw;
  }
}

export const audio = new AudioEngine();

/** 'A4' / 'C#5' / 'Bb3' → Hz. */
export function noteFreq(note: string): number {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(note);
  if (!m) throw new Error(`Bad note "${note}"`);
  const base: Record<string, number> = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
  const semis = base[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) - 4) * 12;
  return 440 * Math.pow(2, semis / 12);
}
