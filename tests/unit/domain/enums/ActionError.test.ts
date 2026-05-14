import { describe, test, expect } from "vitest";
import { ActionError } from "$lib/domain/enums/ActionError";

describe("ActionError", () => {
  describe("available values", () => {
    test("exports the complete action error set without duplicates", () => {
      const values = Object.values(ActionError);

      expect(values).toEqual([
        "NOT_YOUR_TURN",
        "PIECE_NOT_FOUND",
        "PIECE_NOT_OWNED",
        "TARGET_NOT_REACHABLE",
        "INSUFFICIENT_RESOURCES",
        "NO_GENERATION_PANEL",
        "CANNOT_CANCEL",
        "GAME_ALREADY_OVER",
        "INVALID_GAME_STATE",
        "TEMPORARY_GAME_STATE_CALLBACK_FAILED",
        "TEMPORARY_GAME_STATE_RESTORE_FAILED",
      ]);
      expect(new Set(values).size).toBe(values.length);
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
    test("String(ActionError.TEMPORARY_GAME_STATE_CALLBACK_FAILED) returns 'TEMPORARY_GAME_STATE_CALLBACK_FAILED'", () => {
      expect(ActionError.TEMPORARY_GAME_STATE_CALLBACK_FAILED).toBe(
        "TEMPORARY_GAME_STATE_CALLBACK_FAILED",
      );
    });
    test("String(ActionError.TEMPORARY_GAME_STATE_RESTORE_FAILED) returns 'TEMPORARY_GAME_STATE_RESTORE_FAILED'", () => {
      expect(ActionError.TEMPORARY_GAME_STATE_RESTORE_FAILED).toBe(
        "TEMPORARY_GAME_STATE_RESTORE_FAILED",
      );
    });
  });
});
