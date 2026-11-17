/** Returns a number in [0, 1) on every call. */
export type RandomSource = () => number;

/** mulberry32: a small seeded PRNG so CPU choices are reproducible from a seed. */
export function createSeededRandom(seed: number): RandomSource {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}

/** The only place that reads Math.random: a fresh 32-bit unsigned seed. */
export function createRandomSeed(): number {
  return Math.floor(Math.random() * 2 ** 32);
}

/** Fisher–Yates shuffle into a new array; <items> is left untouched. */
export function shuffle<T>(items: readonly T[], random: RandomSource): T[] {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}
