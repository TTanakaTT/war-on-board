import { describe, test, expect } from "vitest";
import { PanelState } from "$lib/domain/enums/PanelState";

describe("PanelState", () => {
  describe("available values", () => {
    test("exposes every board highlight state exactly once", () => {
      const states = [
        PanelState.UNOCCUPIED,
        PanelState.OCCUPIED,
        PanelState.SELECTED,
        PanelState.MOVABLE,
        PanelState.IMMOVABLE,
      ];

      expect(states.map(String)).toEqual([
        "unoccupied",
        "occupied",
        "selected",
        "movable",
        "immovable",
      ]);
      expect(new Set(states).size).toBe(states.length);
    });
  });

  describe("String conversion", () => {
    test("String(PanelState.UNOCCUPIED) returns 'unoccupied'", () => {
      expect(String(PanelState.UNOCCUPIED)).toBe("unoccupied");
    });
    test("String(PanelState.OCCUPIED) returns 'occupied'", () => {
      expect(String(PanelState.OCCUPIED)).toBe("occupied");
    });
    test("String(PanelState.SELECTED) returns 'selected'", () => {
      expect(String(PanelState.SELECTED)).toBe("selected");
    });
    test("String(PanelState.MOVABLE) returns 'movable'", () => {
      expect(String(PanelState.MOVABLE)).toBe("movable");
    });
    test("String(PanelState.IMMOVABLE) returns 'immovable'", () => {
      expect(String(PanelState.IMMOVABLE)).toBe("immovable");
    });
  });

  describe("identity", () => {
    test("each instance is unique (UNOCCUPIED !== OCCUPIED)", () => {
      expect(PanelState.UNOCCUPIED).not.toBe(PanelState.OCCUPIED);
      expect(PanelState.OCCUPIED).not.toBe(PanelState.SELECTED);
      expect(PanelState.SELECTED).not.toBe(PanelState.MOVABLE);
      expect(PanelState.MOVABLE).not.toBe(PanelState.IMMOVABLE);
    });
  });
});
