import { describe, test, expect } from "vitest";
import { Player } from "$lib/domain/enums/Player";

describe("Player", () => {
  describe("singleton instances", () => {
    test("Player.SELF is defined", () => {
      expect(Player.SELF).toBeDefined();
    });
    test("Player.OPPONENT is defined", () => {
      expect(Player.OPPONENT).toBeDefined();
    });
    test("Player.UNKNOWN is defined", () => {
      expect(Player.UNKNOWN).toBeDefined();
    });
  });

  describe("String conversion", () => {
    test("String(Player.SELF) returns 'self'", () => {
      expect(String(Player.SELF)).toBe("self");
    });
    test("String(Player.OPPONENT) returns 'opponent'", () => {
      expect(String(Player.OPPONENT)).toBe("opponent");
    });
    test("String(Player.UNKNOWN) returns 'unknown'", () => {
      expect(String(Player.UNKNOWN)).toBe("unknown");
    });
  });

  describe("identity", () => {
    test("each instance is unique (SELF !== OPPONENT !== UNKNOWN)", () => {
      expect(Player.SELF).not.toBe(Player.OPPONENT);
      expect(Player.OPPONENT).not.toBe(Player.UNKNOWN);
      expect(Player.SELF).not.toBe(Player.UNKNOWN);
    });
  });

  describe("as Record key", () => {
    test("can be used as Record key via String()", () => {
      const record: Record<string, number> = {};
      record[String(Player.SELF)] = 10;
      record[String(Player.OPPONENT)] = 20;
      expect(record["self"]).toBe(10);
      expect(record["opponent"]).toBe(20);
    });
  });
});
