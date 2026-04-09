import { describe, test, expect } from "vitest";
import { PanelState } from "$lib/domain/enums/PanelState";

describe("PanelState", () => {
  describe("singleton instances", () => {
    test("PanelState.UNOCCUPIED is defined", () => {
      expect(PanelState.UNOCCUPIED).toBeDefined();
    });
    test("PanelState.OCCUPIED is defined", () => {
      expect(PanelState.OCCUPIED).toBeDefined();
    });
    test("PanelState.SELECTED is defined", () => {
      expect(PanelState.SELECTED).toBeDefined();
    });
    test("PanelState.MOVABLE is defined", () => {
      expect(PanelState.MOVABLE).toBeDefined();
    });
    test("PanelState.IMMOVABLE is defined", () => {
      expect(PanelState.IMMOVABLE).toBeDefined();
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
