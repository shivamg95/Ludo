import type { RngState } from './types';

/** Mulberry32 PRNG — deterministic, fast, good enough for dice. */
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed: number): RngState {
  return { seed: seed >>> 0, cursor: 0 };
}

/** Advance RNG by `n` steps and return the last float in [0,1). */
export function nextFloat(rng: RngState, n = 1): { value: number; rng: RngState } {
  const gen = mulberry32(rng.seed);
  let value = 0;
  const target = rng.cursor + n;
  for (let i = 0; i < target; i++) {
    value = gen();
  }
  return { value, rng: { seed: rng.seed, cursor: target } };
}

/** Roll a fair d6 using the seeded RNG. */
export function rollD6(rng: RngState): { value: number; rng: RngState } {
  const { value, rng: next } = nextFloat(rng);
  return { value: Math.floor(value * 6) + 1, rng: next };
}

/** Pick a random integer in [0, maxExclusive) using the seeded RNG. */
export function randomInt(rng: RngState, maxExclusive: number): { value: number; rng: RngState } {
  if (maxExclusive <= 0) return { value: 0, rng };
  const { value, rng: next } = nextFloat(rng);
  return { value: Math.floor(value * maxExclusive), rng: next };
}
