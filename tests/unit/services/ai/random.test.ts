import { describe, expect, test } from "vitest";
import { createSeededRandom, shuffle } from "#lib/services/ai/random.ts";

const SAMPLE_SIZE = 1000;

function takeValues(seed: number, count: number): number[] {
  const random = createSeededRandom(seed);
  return Array.from({ length: count }, () => random());
}

describe("createSeededRandom", () => {
  test("produces the same sequence for the same seed", () => {
    expect(takeValues(12345, 10)).toEqual(takeValues(12345, 10));
  });

  test("produces different sequences for different seeds", () => {
    expect(takeValues(12345, 10)).not.toEqual(takeValues(67890, 10));
  });

  test("keeps every value in [0, 1)", () => {
    for (const value of takeValues(42, SAMPLE_SIZE)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("shuffle", () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8];

  test("returns the same elements reordered without changing the original array", () => {
    const original = [...items];

    const shuffled = shuffle(items, createSeededRandom(7));

    expect(shuffled).not.toBe(items);
    expect([...shuffled].sort((left, right) => left - right)).toEqual(original);
    expect(items).toEqual(original);
  });

  test("returns the same order for the same seed", () => {
    expect(shuffle(items, createSeededRandom(99))).toEqual(shuffle(items, createSeededRandom(99)));
  });
});
