import { describe, test, expect } from "vitest";
import { PieceType } from "$lib/domain/enums/PieceType";

describe("PieceType", () => {
  describe("available values", () => {
    test("exposes every piece type exactly once", () => {
      const pieceTypes = [PieceType.INFANTRY, PieceType.ROOK, PieceType.NOBLE];

      expect(pieceTypes.map(String)).toEqual(["infantry", "rook", "noble"]);
      expect(new Set(pieceTypes).size).toBe(pieceTypes.length);
    });
  });

  describe("String conversion", () => {
    test("String(PieceType.INFANTRY) returns 'infantry'", () => {
      expect(String(PieceType.INFANTRY)).toBe("infantry");
    });

    test("String(PieceType.ROOK) returns 'rook'", () => {
      expect(String(PieceType.ROOK)).toBe("rook");
    });

    test("String(PieceType.NOBLE) returns 'noble'", () => {
      expect(String(PieceType.NOBLE)).toBe("noble");
    });
  });

  describe("config", () => {
    test("INFANTRY config: cost=8, maxHp=10, attackPiece=5, attackWall=1, defense=1, movement=1, attackRange=1", () => {
      const cfg = PieceType.INFANTRY.config;
      expect(cfg.cost).toBe(8);
      expect(cfg.maxHp).toBe(10);
      expect(cfg.attackPowerAgainstPiece).toBe(5);
      expect(cfg.attackPowerAgainstWall).toBe(1);
      expect(cfg.defense).toBe(1);
      expect(cfg.movement).toBe(1);
      expect(cfg.attackRange).toBe(1);
    });

    test("ROOK config: cost=10, maxHp=10, attackPiece=2, attackWall=2, defense=1, movement=1, attackRange=1", () => {
      const cfg = PieceType.ROOK.config;
      expect(cfg.cost).toBe(10);
      expect(cfg.maxHp).toBe(10);
      expect(cfg.attackPowerAgainstPiece).toBe(2);
      expect(cfg.attackPowerAgainstWall).toBe(2);
      expect(cfg.defense).toBe(1);
      expect(cfg.movement).toBe(1);
      expect(cfg.attackRange).toBe(1);
    });

    test("NOBLE config: cost=10, maxHp=5, attackPiece=0, attackWall=0, defense=0, movement=1, attackRange=0", () => {
      const cfg = PieceType.NOBLE.config;
      expect(cfg.cost).toBe(10);
      expect(cfg.maxHp).toBe(5);
      expect(cfg.attackPowerAgainstPiece).toBe(0);
      expect(cfg.attackPowerAgainstWall).toBe(0);
      expect(cfg.defense).toBe(0);
      expect(cfg.movement).toBe(1);
      expect(cfg.attackRange).toBe(0);
    });

    test("mergeability matches the intended combat roles", () => {
      expect(PieceType.INFANTRY.config.mergeable).toBe(true);
      expect(PieceType.ROOK.config.mergeable).toBe(false);
      expect(PieceType.NOBLE.config.mergeable).toBe(false);
    });
  });
});
