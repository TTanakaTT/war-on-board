import { describe, expect, test } from "vitest";
import { armyPower, liveCombatUnitCounts, pieceConfig, PieceType, pos } from "#lib/domain/model.ts";
import { add, newGame } from "../helpers.ts";

describe("armyPower", () => {
  test("sums cost × stackCount of combat units, excluding nobles and rooks", () => {
    newGame();
    const pieces = [
      add(1, pos(0, 0), undefined, { stackCount: 3 }),
      add(2, pos(0, 1), undefined, { pieceType: PieceType.CAVALRY, stackCount: 2 }),
      add(3, pos(1, 0), undefined, { pieceType: PieceType.NOBLE }),
      add(4, pos(1, 1), undefined, { pieceType: PieceType.ROOK }),
    ];
    expect(armyPower(liveCombatUnitCounts(pieces))).toBe(
      pieceConfig(PieceType.INFANTRY).cost * 3 + pieceConfig(PieceType.CAVALRY).cost * 2,
    );
  });
});
