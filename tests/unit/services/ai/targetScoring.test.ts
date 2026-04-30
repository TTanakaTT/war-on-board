import { expect, test, describe } from "vitest";
import { PanelPosition } from "$lib/domain/entities/PanelPosition";
import { Piece } from "$lib/domain/entities/Piece";
import { PieceType } from "$lib/domain/enums/PieceType";
import { Player } from "$lib/domain/enums/Player";
import { getPieceCombatStats } from "$lib/services/ai/targetScoring";
import type { PieceSnapshot } from "$lib/domain/types/api";

describe("getPieceCombatStats", () => {
  test.each([
    { pieceTypeSnapshot: "knight", pieceType: PieceType.KNIGHT, stackCount: 1 },
    { pieceTypeSnapshot: "rook", pieceType: PieceType.ROOK, stackCount: 2 },
    { pieceTypeSnapshot: "bishop", pieceType: PieceType.BISHOP, stackCount: 1 },
    { pieceTypeSnapshot: "bishop", pieceType: PieceType.BISHOP, stackCount: 3 },
  ] as const)(
    "derives %s stats from PieceType config for stackCount=%i",
    ({ pieceTypeSnapshot, pieceType, stackCount }) => {
      const panelPosition = new PanelPosition({ horizontalLayer: 0, verticalLayer: 0 });
      const domainPiece = new Piece({
        id: 1,
        panelPosition,
        initialPosition: panelPosition,
        player: Player.SELF,
        pieceType,
        stackCount,
      });
      const pieceSnapshot: PieceSnapshot = {
        id: domainPiece.id,
        panelPosition: {
          horizontalLayer: panelPosition.horizontalLayer,
          verticalLayer: panelPosition.verticalLayer,
        },
        initialPosition: {
          horizontalLayer: panelPosition.horizontalLayer,
          verticalLayer: panelPosition.verticalLayer,
        },
        player: "self",
        pieceType: pieceTypeSnapshot,
        hp: domainPiece.hp,
        stackCount: domainPiece.stackCount,
        maxHp: domainPiece.maxHp,
      };

      expect(getPieceCombatStats(pieceSnapshot)).toEqual({
        attackPowerAgainstPiece: domainPiece.attackPowerAgainstPiece,
        attackPowerAgainstWall: domainPiece.attackPowerAgainstWall,
        canAttack: domainPiece.canAttack,
        mergeable: pieceType.config.mergeable,
      });
    },
  );
});
