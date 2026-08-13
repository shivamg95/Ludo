import { prefersReducedMotion } from '../ui/motion';

export type Sfx = 'roll' | 'move' | 'capture' | 'home' | 'land';

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!ctx) ctx = new AudioContext();
    return ctx;
  } catch {
    return null;
  }
}

export function resumeAudio() {
  const ac = getCtx();
  if (ac && ac.state === 'suspended') void ac.resume();
}

function tone(
  ac: AudioContext,
  now: number,
  freq: number,
  dur: number,
  gain0: number,
  type: OscillatorType = 'sine',
) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(gain0, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(now);
  osc.stop(now + dur);
}

function noiseBurst(ac: AudioContext, now: number, dur: number, freq: number, gain0: number) {
  const n = Math.max(1, Math.floor(ac.sampleRate * dur));
  const buffer = ac.createBuffer(1, n, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = 0.7;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(gain0, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(ac.destination);
  src.start(now);
  src.stop(now + dur);
}

function haptic(kind: Sfx) {
  if (prefersReducedMotion()) return;
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  if (kind === 'roll') navigator.vibrate(10);
  else if (kind === 'capture') navigator.vibrate(25);
  else if (kind === 'home') navigator.vibrate([8, 30, 12]);
}

export function playSfx(kind: Sfx) {
  resumeAudio();
  haptic(kind);
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;

  if (kind === 'roll') {
    noiseBurst(ac, now, 0.16, 900, 0.1);
    tone(ac, now, 140, 0.18, 0.07, 'triangle');
    return;
  }
  if (kind === 'land' || kind === 'move') {
    tone(ac, now, kind === 'land' ? 520 : 440, 0.09, 0.045, 'triangle');
    return;
  }
  if (kind === 'capture') {
    tone(ac, now, 180, 0.22, 0.09, 'sawtooth');
    tone(ac, now + 0.02, 110, 0.28, 0.08, 'sine');
    return;
  }
  // home
  tone(ac, now, 523, 0.16, 0.06, 'sine');
  tone(ac, now + 0.09, 784, 0.22, 0.055, 'sine');
}
