import { describe, test, expect } from "vitest";
import { PieceType } from "$lib/domain/enums/PieceType";

describe("PieceType", () => {
  describe("available values", () => {
    test("exposes every piece type exactly once", () => {
      const pieceTypes = [
        PieceType.INFANTRY,
        PieceType.ROOK,
        PieceType.NOBLE,
        PieceType.ARCHER,
        PieceType.CAVALRY,
        PieceType.HEAVY,
        PieceType.SIEGE,
      ];

      expect(pieceTypes.map(String)).toEqual([
        "infantry",
        "rook",
        "noble",
        "archer",
        "cavalry",
        "heavy",
        "siege",
      ]);
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

    test("String(PieceType.ARCHER) returns 'archer'", () => {
      expect(String(PieceType.ARCHER)).toBe("archer");
    });

    test("String(PieceType.CAVALRY) returns 'cavalry'", () => {
      expect(String(PieceType.CAVALRY)).toBe("cavalry");
    });

    test("String(PieceType.HEAVY) returns 'heavy'", () => {
      expect(String(PieceType.HEAVY)).toBe("heavy");
    });

    test("String(PieceType.SIEGE) returns 'siege'", () => {
      expect(String(PieceType.SIEGE)).toBe("siege");
    });
  });

  describe("config", () => {
    test("INFANTRY config: cost=8, maxHp=10, attackPiece=5, attackWall=1, defense=1, movement=1, attackRange=1, iconName=chess_pawn", () => {
      const cfg = PieceType.INFANTRY.config;
      expect(cfg.cost).toBe(8);
      expect(cfg.maxHp).toBe(10);
      expect(cfg.attackPowerAgainstPiece).toBe(5);
      expect(cfg.attackPowerAgainstWall).toBe(1);
      expect(cfg.defense).toBe(1);
      expect(cfg.movement).toBe(1);
      expect(cfg.attackRange).toBe(1);
      expect(cfg.iconName).toBe("chess_pawn");
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

    test("ARCHER config: cost=10, maxHp=8, attackPiece=4, attackWall=0, defense=0, movement=1, attackRange=2, iconName=archer", () => {
      const cfg = PieceType.ARCHER.config;
      expect(cfg.cost).toBe(10);
      expect(cfg.maxHp).toBe(8);
      expect(cfg.attackPowerAgainstPiece).toBe(4);
      expect(cfg.attackPowerAgainstWall).toBe(0);
      expect(cfg.defense).toBe(0);
      expect(cfg.movement).toBe(1);
      expect(cfg.attackRange).toBe(2);
      expect(cfg.iconName).toBe("archer");
    });

    test("CAVALRY config: cost=16, maxHp=12, attackPiece=8, attackWall=1, defense=1, movement=2, attackRange=1, iconName=chess_knight", () => {
      const cfg = PieceType.CAVALRY.config;
      expect(cfg.cost).toBe(16);
      expect(cfg.maxHp).toBe(12);
      expect(cfg.attackPowerAgainstPiece).toBe(8);
      expect(cfg.attackPowerAgainstWall).toBe(1);
      expect(cfg.defense).toBe(1);
      expect(cfg.movement).toBe(2);
      expect(cfg.attackRange).toBe(1);
      expect(cfg.iconName).toBe("chess_knight");
    });

    test("HEAVY config: cost=16, maxHp=20, attackPiece=6, attackWall=1, defense=2, movement=0.5, attackRange=1, iconName=shield", () => {
      const cfg = PieceType.HEAVY.config;
      expect(cfg.cost).toBe(16);
      expect(cfg.maxHp).toBe(20);
      expect(cfg.attackPowerAgainstPiece).toBe(6);
      expect(cfg.attackPowerAgainstWall).toBe(1);
      expect(cfg.defense).toBe(2);
      expect(cfg.movement).toBe(0.5);
      expect(cfg.attackRange).toBe(1);
      expect(cfg.iconName).toBe("shield");
    });

    test("SIEGE config: cost=30, maxHp=30, attackPiece=0, attackWall=5, defense=3, movement=1, attackRange=1, iconName=siege", () => {
      const cfg = PieceType.SIEGE.config;
      expect(cfg.cost).toBe(30);
      expect(cfg.maxHp).toBe(30);
      expect(cfg.attackPowerAgainstPiece).toBe(0);
      expect(cfg.attackPowerAgainstWall).toBe(5);
      expect(cfg.defense).toBe(3);
      expect(cfg.movement).toBe(1);
      expect(cfg.attackRange).toBe(1);
      expect(cfg.iconName).toBe("siege");
    });

    test("mergeability matches the intended combat roles", () => {
      expect(PieceType.INFANTRY.config.mergeable).toBe(true);
      expect(PieceType.ROOK.config.mergeable).toBe(false);
      expect(PieceType.NOBLE.config.mergeable).toBe(false);
      expect(PieceType.ARCHER.config.mergeable).toBe(true);
      expect(PieceType.CAVALRY.config.mergeable).toBe(true);
      expect(PieceType.HEAVY.config.mergeable).toBe(true);
      expect(PieceType.SIEGE.config.mergeable).toBe(true);
    });
  });
});
