import { describe, expect, test } from "vitest";
import { PanelPosition } from "#lib/domain/entities/PanelPosition.ts";
import { Piece } from "#lib/domain/entities/Piece.ts";
import { PieceType } from "#lib/domain/enums/PieceType.ts";
import { Player } from "#lib/domain/enums/Player.ts";
import {
  armyPower,
  deadCombatUnitCounts,
  liveCombatUnitCounts,
  visiblePieceTypeCounts,
} from "#lib/presentation/playerInfoPresentation.ts";

const COMBAT_UNIT_ORDER = [
  PieceType.INFANTRY,
  PieceType.ARCHER,
  PieceType.CAVALRY,
  PieceType.HEAVY,
  PieceType.SIEGE,
];

function createPiece(pieceType: PieceType, stackCount = 1): Piece {
  return new Piece({
    panelPosition: new PanelPosition({ horizontalLayer: 0, verticalLayer: 0 }),
    player: Player.SELF,
    pieceType,
    stackCount,
  });
}

describe("playerInfoPresentation", () => {
  describe("liveCombatUnitCounts", () => {
    test("lists combat unit types in display order without nobles or rooks", () => {
      const counts = liveCombatUnitCounts([
        createPiece(PieceType.NOBLE),
        createPiece(PieceType.ROOK),
        createPiece(PieceType.CAVALRY),
      ]);

      expect(counts.map((pieceTypeCount) => pieceTypeCount.pieceType)).toEqual(COMBAT_UNIT_ORDER);
      expect(counts.map((pieceTypeCount) => pieceTypeCount.count)).toEqual([0, 0, 1, 0, 0]);
    });

    test("counts a merged piece as its stackCount", () => {
      const counts = liveCombatUnitCounts([createPiece(PieceType.INFANTRY, 3)]);

      expect(
        counts.find((pieceTypeCount) => pieceTypeCount.pieceType === PieceType.INFANTRY),
      ).toEqual({ pieceType: PieceType.INFANTRY, count: 3 });
    });
  });

  describe("deadCombatUnitCounts", () => {
    test("reads dead unit counts for combat units only, in display order", () => {
      const counts = deadCombatUnitCounts({
        infantry: 1,
        rook: 2,
        noble: 3,
        archer: 4,
        cavalry: 5,
        heavy: 6,
        siege: 7,
      });

      expect(counts).toEqual([
        { pieceType: PieceType.INFANTRY, count: 1 },
        { pieceType: PieceType.ARCHER, count: 4 },
        { pieceType: PieceType.CAVALRY, count: 5 },
        { pieceType: PieceType.HEAVY, count: 6 },
        { pieceType: PieceType.SIEGE, count: 7 },
      ]);
    });
  });

  describe("visiblePieceTypeCounts", () => {
    test("drops piece types with a zero count", () => {
      expect(
        visiblePieceTypeCounts([
          { pieceType: PieceType.INFANTRY, count: 0 },
          { pieceType: PieceType.ARCHER, count: 2 },
          { pieceType: PieceType.CAVALRY, count: 0 },
          { pieceType: PieceType.SIEGE, count: 1 },
        ]),
      ).toEqual([
        { pieceType: PieceType.ARCHER, count: 2 },
        { pieceType: PieceType.SIEGE, count: 1 },
      ]);
    });

    test("keeps only the first piece type with 0 when every count is zero", () => {
      expect(
        visiblePieceTypeCounts([
          { pieceType: PieceType.INFANTRY, count: 0 },
          { pieceType: PieceType.ARCHER, count: 0 },
        ]),
      ).toEqual([{ pieceType: PieceType.INFANTRY, count: 0 }]);
    });
  });

  describe("armyPower", () => {
    test("sums cost times count", () => {
      expect(
        armyPower([
          { pieceType: PieceType.INFANTRY, count: 3 },
          { pieceType: PieceType.SIEGE, count: 2 },
          { pieceType: PieceType.ARCHER, count: 0 },
        ]),
      ).toBe(PieceType.INFANTRY.config.cost * 3 + PieceType.SIEGE.config.cost * 2);
    });
  });
});
