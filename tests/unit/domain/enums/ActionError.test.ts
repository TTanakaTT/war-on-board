import { describe, test, expect } from "vitest";
import { ActionError } from "$lib/domain/enums/ActionError";

describe("ActionError", () => {
  describe("singleton instances", () => {
    test("ActionError.NOT_YOUR_TURN is defined", () => {
      expect(ActionError.NOT_YOUR_TURN).toBeDefined();
    });
    test("ActionError.PIECE_NOT_FOUND is defined", () => {
      expect(ActionError.PIECE_NOT_FOUND).toBeDefined();
    });
    test("ActionError.PIECE_NOT_OWNED is defined", () => {
      expect(ActionError.PIECE_NOT_OWNED).toBeDefined();
    });
    test("ActionError.TARGET_NOT_REACHABLE is defined", () => {
      expect(ActionError.TARGET_NOT_REACHABLE).toBeDefined();
    });
    test("ActionError.INSUFFICIENT_RESOURCES is defined", () => {
      expect(ActionError.INSUFFICIENT_RESOURCES).toBeDefined();
    });
    test("ActionError.NO_GENERATION_PANEL is defined", () => {
      expect(ActionError.NO_GENERATION_PANEL).toBeDefined();
    });
    test("ActionError.CANNOT_CANCEL is defined", () => {
      expect(ActionError.CANNOT_CANCEL).toBeDefined();
    });
    test("ActionError.GAME_ALREADY_OVER is defined", () => {
      expect(ActionError.GAME_ALREADY_OVER).toBeDefined();
    });
    test("ActionError.INVALID_GAME_STATE is defined", () => {
      expect(ActionError.INVALID_GAME_STATE).toBeDefined();
    });
  });

  describe("String conversion", () => {
    test("String(ActionError.NOT_YOUR_TURN) returns 'NOT_YOUR_TURN'", () => {
      expect(ActionError.NOT_YOUR_TURN).toBe("NOT_YOUR_TURN");
    });
    test("String(ActionError.GAME_ALREADY_OVER) returns 'GAME_ALREADY_OVER'", () => {
      expect(ActionError.GAME_ALREADY_OVER).toBe("GAME_ALREADY_OVER");
    });
    test("String(ActionError.INVALID_GAME_STATE) returns 'INVALID_GAME_STATE'", () => {
      expect(ActionError.INVALID_GAME_STATE).toBe("INVALID_GAME_STATE");
    });
  });
});
