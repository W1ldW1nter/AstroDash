import { audio, noteFreq } from './engine';
import { TRACKS, type Channel, type TrackName } from './tracks';

/** How far ahead notes are scheduled (s), and how often the scheduler wakes (ms). */
const LOOKAHEAD = 0.12;
const TICK_MS = 25;
const FADE_S = 0.35;
const DUCK_LEVEL = 0.3;

interface NoteEvent {
  freq: number;
  /** Length in steps. */
  len: number;
}

interface ParsedChannel {
  def: Channel;
  /** One entry per step: a note starting there, a drum hit, or null. */
  events: (NoteEvent | string | null)[];
}

function parse(ch: Channel): ParsedChannel {
  const steps = ch.steps;
  const events: (NoteEvent | string | null)[] = steps.map(() => null);
  steps.forEach((tok, i) => {
    if (tok === '.' || tok === '-') return;
    if (ch.wave === 'drums') {
      events[i] = tok;
      return;
    }
    let len = 1;
    while (steps[(i + len) % steps.length] === '-' && len < steps.length) len++;
    events[i] = { freq: noteFreq(tok), len };
  });
  return { def: ch, events };
}

const parsed = new Map<TrackName, ParsedChannel[]>();
function channelsOf(name: TrackName): ParsedChannel[] {
  let p = parsed.get(name);
  if (!p) {
    p = TRACKS[name].channels.map(parse);
    parsed.set(name, p);
  }
  return p;
}

/**
 * Step sequencer for the chiptune tracks. Uses the usual WebAudio "lookahead"
 * pattern: a timer wakes every 25 ms and schedules the notes due in the next
 * 120 ms on the audio clock, so timing stays tight even if frames hitch.
 */
class MusicPlayer {
  current: TrackName | null = null;
  private wanted: TrackName | null = null;
  private gain: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private nextTime = 0;
  private ducked = false;
  /** Total notes scheduled (testing aid). */
  scheduled = 0;

  /** Start a track (crossfading from the current one). Playing the same track again does nothing. */
  play(name: TrackName): void {
    this.wanted = name;
    if (this.current === name) return;
    audio.whenReady(() => {
      if (this.wanted === name && this.current !== name) this.start(name);
    });
  }

  stop(): void {
    this.wanted = null;
    this.fadeOut();
    this.current = null;
  }

  /** Lower the music (pause menu, upgrade screen). */
  duck(on: boolean): void {
    this.ducked = on;
    const ctx = audio.ctx;
    if (ctx && this.gain) this.gain.gain.setTargetAtTime(on ? DUCK_LEVEL : 1, ctx.currentTime, 0.08);
  }

  private start(name: TrackName): void {
    const ctx = audio.ctx!;
    this.fadeOut();
    this.current = name;
    this.gain = ctx.createGain();
    this.gain.gain.value = this.ducked ? DUCK_LEVEL : 1;
    this.gain.connect(audio.musicBus);
    this.step = 0;
    this.nextTime = ctx.currentTime + 0.06;
    const gain = this.gain;
    this.timer = setInterval(() => this.tick(name, gain), TICK_MS);
    this.tick(name, gain);
  }

  private fadeOut(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const ctx = audio.ctx;
    const g = this.gain;
    this.gain = null;
    if (!ctx || !g) return;
    g.gain.cancelScheduledValues(ctx.currentTime);
    g.gain.setValueAtTime(g.gain.value, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0, ctx.currentTime + FADE_S);
    setTimeout(() => g.disconnect(), FADE_S * 1000 + 600);
  }

  private tick(name: TrackName, gain: GainNode): void {
    const ctx = audio.ctx!;
    const track = TRACKS[name];
    const stepDur = 60 / track.bpm / 4;
    const channels = channelsOf(name);
    const length = Math.max(...channels.map((c) => c.def.steps.length));

    // If the timer was starved (background tab), skip ahead instead of bursting notes.
    if (this.nextTime < ctx.currentTime - 0.25) this.nextTime = ctx.currentTime + 0.02;

    while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
      if (!track.loop && this.step >= length) {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
        if (this.current === name) this.current = null;
        return;
      }
      for (const ch of channels) this.playStep(ch, this.step, this.nextTime, stepDur, gain, track.loop);
      this.step++;
      this.nextTime += stepDur;
    }
  }

  private playStep(ch: ParsedChannel, step: number, t: number, stepDur: number, bus: GainNode, loop: boolean): void {
    const n = ch.events.length;
    const s = step - (ch.def.delay ?? 0);
    if (s < 0 && !loop) return;
    if (!loop && s >= n) return;
    const ev = ch.events[((s % n) + n) % n];
    if (!ev) return;
    const vol = ch.def.vol;
    this.scheduled++;

    if (typeof ev === 'string') {
      drum(ev, t, vol, bus);
      return;
    }
    if (ch.def.wave === 'drums') return;
    audio.tone({
      wave: ch.def.wave,
      freq: ev.freq,
      dur: ev.len * stepDur * (ch.def.env === 'hold' ? 0.95 : 1),
      vol,
      at: t,
      abs: true,
      attack: 0.005,
      env: ch.def.env ?? 'pluck',
      bus,
    });
  }
}

function drum(kind: string, t: number, vol: number, bus: GainNode): void {
  switch (kind) {
    case 'k':
      audio.tone({ wave: 'sine', freq: 150, to: 40, dur: 0.14, vol: vol * 0.9, at: t, abs: true, bus });
      break;
    case 's':
      audio.noise({ dur: 0.12, vol: vol * 0.45, at: t, abs: true, filter: 'bandpass', freq: 1800, q: 0.8, bus });
      audio.tone({ wave: 'triangle', freq: 220, to: 120, dur: 0.06, vol: vol * 0.3, at: t, abs: true, bus });
      break;
    case 'h':
      audio.noise({ dur: 0.03, vol: vol * 0.18, at: t, abs: true, filter: 'highpass', freq: 7000, bus });
      break;
    case 'o':
      audio.noise({ dur: 0.16, vol: vol * 0.16, at: t, abs: true, filter: 'highpass', freq: 6000, bus });
      break;
  }
}

export const music = new MusicPlayer();
