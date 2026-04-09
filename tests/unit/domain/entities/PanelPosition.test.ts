import { describe, test, expect } from "vitest";
import { PanelPosition } from "$lib/domain/entities/PanelPosition";

const pos = (h: number, v: number) => new PanelPosition({ horizontalLayer: h, verticalLayer: v });

describe("PanelPosition", () => {
  describe("equals", () => {
    test("returns true for identical coordinates", () => {
      expect(pos(1, 2).equals(pos(1, 2))).toBe(true);
    });

    test("returns false when horizontalLayer differs", () => {
      expect(pos(1, 2).equals(pos(2, 2))).toBe(false);
    });

    test("returns false when verticalLayer differs", () => {
      expect(pos(1, 2).equals(pos(1, 3))).toBe(false);
    });

    test("returns false when both layers differ", () => {
      expect(pos(1, 2).equals(pos(3, 4))).toBe(false);
    });
  });

  describe("isAdjacent", () => {
    test("returns false for the same position (self)", () => {
      expect(pos(0, 0).isAdjacent(pos(0, 0))).toBe(false);
    });

    test("center (0,0) is adjacent to (1,0), (0,1), (0,-1), (-1,0), (1,-1), (-1,-1)", () => {
      const center = pos(0, 0);
      expect(center.isAdjacent(pos(1, 0))).toBe(true);
      expect(center.isAdjacent(pos(0, 1))).toBe(true);
      expect(center.isAdjacent(pos(0, -1))).toBe(true);
      expect(center.isAdjacent(pos(-1, 0))).toBe(true);
      expect(center.isAdjacent(pos(1, -1))).toBe(true);
      expect(center.isAdjacent(pos(-1, -1))).toBe(true);
    });

    test("center (0,0) is NOT adjacent to (1,1) or (-1,1)", () => {
      const center = pos(0, 0);
      expect(center.isAdjacent(pos(1, 1))).toBe(false);
      expect(center.isAdjacent(pos(-1, 1))).toBe(false);
    });

    test("positive horizontalLayer: (1,0) is adjacent to (2,0) and (1,1)", () => {
      const p = pos(1, 0);
      expect(p.isAdjacent(pos(2, 0))).toBe(true);
      expect(p.isAdjacent(pos(1, 1))).toBe(true);
    });

    test("positive horizontalLayer: (1,0) is NOT adjacent to (2,1)", () => {
      expect(pos(1, 0).isAdjacent(pos(2, 1))).toBe(false);
    });

    test("negative horizontalLayer: (-1,0) is adjacent to (-2,0) and (-1,1)", () => {
      const p = pos(-1, 0);
      expect(p.isAdjacent(pos(-2, 0))).toBe(true);
      expect(p.isAdjacent(pos(-1, 1))).toBe(true);
    });

    test("negative horizontalLayer: (-1,0) is NOT adjacent to (-2,1)", () => {
      expect(pos(-1, 0).isAdjacent(pos(-2, 1))).toBe(false);
    });

    test("positions differing by 2 in horizontalLayer are not adjacent", () => {
      expect(pos(0, 0).isAdjacent(pos(2, 0))).toBe(false);
      expect(pos(0, 0).isAdjacent(pos(-2, 0))).toBe(false);
    });

    test("positions differing by 2 in verticalLayer are not adjacent", () => {
      expect(pos(0, 0).isAdjacent(pos(0, 2))).toBe(false);
      expect(pos(0, 0).isAdjacent(pos(0, -2))).toBe(false);
    });
  });
});
