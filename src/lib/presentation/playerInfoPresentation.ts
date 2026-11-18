import type { Piece } from "#lib/domain/entities/Piece.ts";
import type { PieceType } from "#lib/domain/enums/PieceType.ts";
import type { MatchStatsPieceKey, PieceTypeMatchStats } from "#lib/domain/types/matchStats.ts";
import { PIECE_TYPE_DISPLAY_ORDER } from "#lib/presentation/piecePresentation.ts";

export interface PieceTypeCount {
  pieceType: PieceType;
  count: number;
}

/** Units per piece type in display order. A merged piece counts as its stackCount. */
export function liveUnitCounts(pieces: readonly Piece[]): PieceTypeCount[] {
  return PIECE_TYPE_DISPLAY_ORDER.map((pieceType) => ({
    pieceType,
    count: pieces
      .filter((piece) => piece.pieceType === pieceType)
      .reduce((sum, piece) => sum + piece.stackCount, 0),
  }));
}

/** Dead units per piece type in display order. */
export function deadUnitCounts(deadUnitCountsByKey: PieceTypeMatchStats): PieceTypeCount[] {
  return PIECE_TYPE_DISPLAY_ORDER.map((pieceType) => ({
    pieceType,
    // Every PieceType's string value matches its deadUnitCounts field name directly.
    count: deadUnitCountsByKey[String(pieceType) as MatchStatsPieceKey],
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

/** Total cost of the combat units in `counts` (see PieceType config `isCombatUnit`). */
export function armyValue(counts: readonly PieceTypeCount[]): number {
  return counts
    .filter((pieceTypeCount) => pieceTypeCount.pieceType.config.isCombatUnit)
    .reduce(
      (sum, pieceTypeCount) => sum + pieceTypeCount.pieceType.config.cost * pieceTypeCount.count,
      0,
    );
}
