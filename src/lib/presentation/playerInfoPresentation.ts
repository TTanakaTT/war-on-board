import type { Piece } from "#lib/domain/entities/Piece.ts";
import type { PieceType } from "#lib/domain/enums/PieceType.ts";
import type { MatchStatsPieceKey, PieceTypeMatchStats } from "#lib/domain/types/matchStats.ts";
import { PIECE_TYPE_DISPLAY_ORDER } from "#lib/presentation/piecePresentation.ts";

export interface PieceTypeCount {
  pieceType: PieceType;
  count: number;
}

/** Combat unit types (see PieceType config `isCombatUnit`) in display order. */
const COMBAT_UNIT_TYPES = PIECE_TYPE_DISPLAY_ORDER.filter(
  (pieceType) => pieceType.config.isCombatUnit,
);

/** Units on the board per combat unit type. A merged piece counts as its stackCount. */
export function liveCombatUnitCounts(pieces: readonly Piece[]): PieceTypeCount[] {
  return COMBAT_UNIT_TYPES.map((pieceType) => ({
    pieceType,
    count: pieces
      .filter((piece) => piece.pieceType === pieceType)
      .reduce((sum, piece) => sum + piece.stackCount, 0),
  }));
}

/** Dead units per combat unit type. */
export function deadCombatUnitCounts(deadUnitCounts: PieceTypeMatchStats): PieceTypeCount[] {
  return COMBAT_UNIT_TYPES.map((pieceType) => ({
    pieceType,
    // Every PieceType's string value matches its deadUnitCounts field name directly.
    count: deadUnitCounts[String(pieceType) as MatchStatsPieceKey],
  }));
}

/**
 * Counts to list in the info panel: only the piece types with a non-zero count, in the
 * given order. When every count is zero, only the first piece type is listed, with 0.
 */
export function visiblePieceTypeCounts(counts: readonly PieceTypeCount[]): PieceTypeCount[] {
  const nonZeroCounts = counts.filter((pieceTypeCount) => pieceTypeCount.count > 0);
  if (nonZeroCounts.length > 0) {
    return nonZeroCounts;
  }

  return counts.slice(0, 1);
}

/** Army power: the total cost of the units in `counts`. */
export function armyPower(counts: readonly PieceTypeCount[]): number {
  return counts.reduce(
    (sum, pieceTypeCount) => sum + pieceTypeCount.pieceType.config.cost * pieceTypeCount.count,
    0,
  );
}
