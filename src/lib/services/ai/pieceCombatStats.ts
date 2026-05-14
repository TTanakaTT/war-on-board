import { PieceType } from "$lib/domain/enums/PieceType";
import type { PieceSnapshot } from "$lib/domain/types/api";
import type { PieceCombatStats } from "$lib/services/ai/types";

const SNAPSHOT_PIECE_TYPES: Record<PieceSnapshot["pieceType"], PieceType> = {
  knight: PieceType.KNIGHT,
  rook: PieceType.ROOK,
  bishop: PieceType.BISHOP,
};

export function getPieceCombatStats(piece: PieceSnapshot): PieceCombatStats {
  const pieceConfig = SNAPSHOT_PIECE_TYPES[piece.pieceType].config;
  const mergeBonus = piece.stackCount - 1;
  const attackPowerAgainstPiece = pieceConfig.attackPowerAgainstPiece + mergeBonus;
  const attackPowerAgainstWall = pieceConfig.attackPowerAgainstWall + mergeBonus;

  return {
    attackPowerAgainstPiece,
    attackPowerAgainstWall,
    canAttack: attackPowerAgainstPiece > 0 || attackPowerAgainstWall > 0,
    mergeable: pieceConfig.mergeable,
  };
}
