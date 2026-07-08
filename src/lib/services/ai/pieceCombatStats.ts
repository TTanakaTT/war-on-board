import { PieceType } from "$lib/domain/enums/PieceType";
import type { PieceSnapshot } from "$lib/domain/types/api";
import type { PieceCombatStats } from "$lib/services/ai/types";

const SNAPSHOT_PIECE_TYPES: Record<PieceSnapshot["pieceType"], PieceType> = {
  infantry: PieceType.INFANTRY,
  rook: PieceType.ROOK,
  noble: PieceType.NOBLE,
  archer: PieceType.ARCHER,
  cavalry: PieceType.CAVALRY,
  heavy: PieceType.HEAVY,
  siege: PieceType.SIEGE,
};

export function getPieceCombatStats(piece: PieceSnapshot): PieceCombatStats {
  const pieceConfig = SNAPSHOT_PIECE_TYPES[piece.pieceType].config;
  // Unlike Piece.attackPowerAgainstPiece (deliberately left per-unit, since
  // MovementRulesService.canDefeatAllDefenders needs the raw value), these AI
  // estimates need the stack's total output to match what CombatService actually
  // deals — see GameApi's "each attacker contributes ... * stackCount" combat rule.
  const attackPowerAgainstPiece = pieceConfig.attackPowerAgainstPiece * piece.stackCount;
  const attackPowerAgainstWall = pieceConfig.attackPowerAgainstWall * piece.stackCount;

  return {
    attackPowerAgainstPiece,
    attackPowerAgainstWall,
    defense: pieceConfig.defense,
    canAttack: attackPowerAgainstPiece > 0 || attackPowerAgainstWall > 0,
    mergeable: pieceConfig.mergeable,
  };
}
