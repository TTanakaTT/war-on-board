import { describe, test, expect } from "vitest";
import { PieceType } from "$lib/domain/enums/PieceType";

describe("PieceType", () => {
  describe("singleton instances", () => {
    test("PieceType.KNIGHT is defined", () => {
      expect(PieceType.KNIGHT).toBeDefined();
    });

    test("PieceType.ROOK is defined", () => {
      expect(PieceType.ROOK).toBeDefined();
    });

    test("PieceType.BISHOP is defined", () => {
      expect(PieceType.BISHOP).toBeDefined();
    });
  });

  describe("String conversion", () => {
    test("String(PieceType.KNIGHT) returns 'knight'", () => {
      expect(String(PieceType.KNIGHT)).toBe("knight");
    });

    test("String(PieceType.ROOK) returns 'rook'", () => {
      expect(String(PieceType.ROOK)).toBe("rook");
    });

    test("String(PieceType.BISHOP) returns 'bishop'", () => {
      expect(String(PieceType.BISHOP)).toBe("bishop");
    });
  });

  describe("config", () => {
    test("KNIGHT config: cost=8, maxHp=10, attackPiece=5, attackWall=2", () => {
      const cfg = PieceType.KNIGHT.config;
      expect(cfg.cost).toBe(8);
      expect(cfg.maxHp).toBe(10);
      expect(cfg.attackPowerAgainstPiece).toBe(5);
      expect(cfg.attackPowerAgainstWall).toBe(2);
    });

    test("ROOK config: cost=10, maxHp=10, attackPiece=2, attackWall=2", () => {
      const cfg = PieceType.ROOK.config;
      expect(cfg.cost).toBe(10);
      expect(cfg.maxHp).toBe(10);
      expect(cfg.attackPowerAgainstPiece).toBe(2);
      expect(cfg.attackPowerAgainstWall).toBe(2);
    });

    test("BISHOP config: cost=10, maxHp=5, attackPiece=0, attackWall=0", () => {
      const cfg = PieceType.BISHOP.config;
      expect(cfg.cost).toBe(10);
      expect(cfg.maxHp).toBe(5);
      expect(cfg.attackPowerAgainstPiece).toBe(0);
      expect(cfg.attackPowerAgainstWall).toBe(0);
    });
  });
});
