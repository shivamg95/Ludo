/**
 * Procedural sound effects — no assets, everything synthesised on demand.
 *
 * Every cue is built from the same primitives: an ADSR-shaped oscillator voice
 * and a filtered noise burst, summed into a master bus with a limiter so
 * overlapping events (a capture during a hop) can never clip.
 */

export type Sfx = 'roll' | 'move' | 'capture' | 'home' | 'tick' | 'extra' | 'forfeit' | 'win';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();

      // Bus: master trim -> limiter -> out. The limiter is what lets each cue
      // stay punchy without the sum of them distorting.
      const gain = ctx.createGain();
      gain.gain.value = 0.5;
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -8;
      limiter.knee.value = 6;
      limiter.ratio.value = 12;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.18;
      gain.connect(limiter);
      limiter.connect(ctx.destination);
      master = gain;
    }
    // Browsers suspend contexts created before a gesture
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function getNoise(ac: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    noiseBuffer = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

interface Env {
  /** Attack, decay and release in seconds. */
  attack?: number;
  decay?: number;
  release?: number;
  peak?: number;
  sustain?: number;
  hold?: number;
}

/** Writes an ADSR contour onto a gain param and returns when it ends. */
function shape(param: AudioParam, t0: number, env: Env): number {
  const { attack = 0.005, decay = 0.08, release = 0.06, peak = 0.5, sustain = 0, hold = 0 } = env;
  param.setValueAtTime(0.0001, t0);
  param.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + attack);
  const sustainLevel = Math.max(peak * sustain, 0.0001);
  param.exponentialRampToValueAtTime(sustainLevel, t0 + attack + decay);
  const releaseStart = t0 + attack + decay + hold;
  param.setValueAtTime(sustainLevel, releaseStart);
  param.exponentialRampToValueAtTime(0.0001, releaseStart + release);
  return releaseStart + release;
}

interface Voice {
  type?: OscillatorType;
  freq: number;
  /** Optional glide target. */
  to?: number;
  at?: number;
  env?: Env;
  detune?: number;
}

function tone(ac: AudioContext, v: Voice) {
  if (!master) return;
  const t0 = ac.currentTime + (v.at ?? 0);
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = v.type ?? 'sine';
  osc.frequency.setValueAtTime(v.freq, t0);
  if (v.detune) osc.detune.value = v.detune;
  if (v.to !== undefined) {
    const end = t0 + (v.env?.decay ?? 0.12) + (v.env?.attack ?? 0.005);
    osc.frequency.exponentialRampToValueAtTime(Math.max(v.to, 1), end);
  }
  osc.connect(gain);
  gain.connect(master);
  const end = shape(gain.gain, t0, v.env ?? {});
  osc.start(t0);
  osc.stop(end + 0.02);
}

interface NoiseHit {
  at?: number;
  /** Band-pass centre; sweeps to `to` when given. */
  freq: number;
  to?: number;
  q?: number;
  type?: BiquadFilterType;
  env?: Env;
}

function noise(ac: AudioContext, n: NoiseHit) {
  if (!master) return;
  const t0 = ac.currentTime + (n.at ?? 0);
  const src = ac.createBufferSource();
  src.buffer = getNoise(ac);
  src.loop = true;
  const filter = ac.createBiquadFilter();
  filter.type = n.type ?? 'bandpass';
  filter.frequency.setValueAtTime(n.freq, t0);
  filter.Q.value = n.q ?? 1;
  const gain = ac.createGain();
  src.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  const end = shape(gain.gain, t0, n.env ?? {});
  if (n.to !== undefined) filter.frequency.exponentialRampToValueAtTime(Math.max(n.to, 20), end);
  src.start(t0);
  src.stop(end + 0.02);
}

function haptic(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* vibration is a nicety; never let it break a turn */
  }
}

const CUES: Record<Sfx, (ac: AudioContext) => void> = {
  // Dice tumbling in a cup: three filtered noise slaps over a low body
  roll: (ac) => {
    noise(ac, { freq: 1800, to: 900, q: 1.2, env: { attack: 0.004, decay: 0.1, release: 0.12, peak: 0.34 } });
    noise(ac, { at: 0.09, freq: 2600, to: 1200, q: 2, env: { attack: 0.003, decay: 0.06, release: 0.08, peak: 0.26 } });
    noise(ac, { at: 0.19, freq: 3200, to: 1500, q: 2.4, env: { attack: 0.003, decay: 0.05, release: 0.09, peak: 0.2 } });
    tone(ac, { type: 'triangle', freq: 150, to: 96, env: { attack: 0.004, decay: 0.16, release: 0.1, peak: 0.22 } });
    haptic(18);
  },

  // A token setting down — soft, frequent, must never fatigue
  move: (ac) => {
    tone(ac, { type: 'triangle', freq: 520, to: 380, env: { attack: 0.004, decay: 0.07, release: 0.06, peak: 0.16 } });
    noise(ac, { freq: 3200, q: 1.4, env: { attack: 0.002, decay: 0.03, release: 0.03, peak: 0.06 } });
  },

  // One click per hop step: tiny, dry, pitched above the move blip
  tick: (ac) => {
    tone(ac, { type: 'square', freq: 880, env: { attack: 0.001, decay: 0.02, release: 0.02, peak: 0.05 } });
    noise(ac, { type: 'highpass', freq: 4200, env: { attack: 0.001, decay: 0.012, release: 0.014, peak: 0.05 } });
  },

  // Capture: body blow plus debris, then a short metallic ring
  capture: (ac) => {
    tone(ac, { type: 'sine', freq: 180, to: 44, env: { attack: 0.004, decay: 0.22, release: 0.16, peak: 0.7 } });
    noise(ac, { type: 'lowpass', freq: 2400, to: 400, q: 0.8, env: { attack: 0.002, decay: 0.12, release: 0.2, peak: 0.4 } });
    tone(ac, { type: 'square', freq: 320, to: 210, at: 0.03, env: { attack: 0.003, decay: 0.1, release: 0.14, peak: 0.16 } });
    haptic([0, 26, 40, 18]);
  },

  // Home: rising major arpeggio with a shimmer tail
  home: (ac) => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      tone(ac, {
        type: 'triangle',
        freq: f,
        at: i * 0.075,
        env: { attack: 0.006, decay: 0.13, release: 0.22, peak: 0.34, sustain: 0.25 },
      });
      tone(ac, {
        type: 'sine',
        freq: f * 2,
        at: i * 0.075,
        env: { attack: 0.006, decay: 0.1, release: 0.16, peak: 0.1 },
      });
    });
    noise(ac, { at: 0.24, freq: 5200, to: 9000, q: 0.7, env: { attack: 0.02, decay: 0.2, release: 0.3, peak: 0.1 } });
    haptic([0, 20, 60, 40]);
  },

  // Extra turn: two-note lift, deliberately smaller than home
  extra: (ac) => {
    tone(ac, { type: 'triangle', freq: 659.25, env: { attack: 0.005, decay: 0.08, release: 0.1, peak: 0.24 } });
    tone(ac, { type: 'triangle', freq: 987.77, at: 0.08, env: { attack: 0.005, decay: 0.1, release: 0.14, peak: 0.24 } });
  },

  // Three sixes: a deflating buzz
  forfeit: (ac) => {
    tone(ac, { type: 'sawtooth', freq: 300, to: 110, env: { attack: 0.006, decay: 0.24, release: 0.18, peak: 0.24 } });
    noise(ac, { type: 'lowpass', freq: 900, to: 220, env: { attack: 0.01, decay: 0.2, release: 0.16, peak: 0.14 } });
    haptic([0, 40, 60, 40]);
  },

  // Victory fanfare for the results transition
  win: (ac) => {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
      tone(ac, {
        type: 'triangle',
        freq: f,
        at: i * 0.11,
        env: { attack: 0.008, decay: 0.16, release: 0.34, peak: 0.36, sustain: 0.3, hold: 0.04 },
      });
    });
    tone(ac, { type: 'sine', freq: 130.81, env: { attack: 0.02, decay: 0.4, release: 0.5, peak: 0.3, sustain: 0.4 } });
    noise(ac, { at: 0.44, freq: 6000, to: 11000, q: 0.6, env: { attack: 0.03, decay: 0.3, release: 0.4, peak: 0.12 } });
    haptic([0, 30, 50, 30, 50, 60]);
  },
};

export function playSfx(kind: Sfx) {
  const ac = getCtx();
  if (!ac || !master) return;
  CUES[kind](ac);
}

/**
 * One tick per step of a hop, scheduled on the audio clock so the rhythm holds
 * even when the main thread stutters.
 */
export function playHopTicks(steps: number, stepMs: number) {
  const ac = getCtx();
  if (!ac || !master || steps <= 0) return;
  const count = Math.min(steps, 8);
  for (let i = 0; i < count; i++) {
    tone(ac, {
      type: 'square',
      freq: 760 + i * 28,
      at: (i * stepMs) / 1000,
      env: { attack: 0.001, decay: 0.022, release: 0.02, peak: 0.05 },
    });
    noise(ac, {
      type: 'highpass',
      freq: 4200,
      at: (i * stepMs) / 1000,
      env: { attack: 0.001, decay: 0.012, release: 0.014, peak: 0.045 },
    });
  }
}
