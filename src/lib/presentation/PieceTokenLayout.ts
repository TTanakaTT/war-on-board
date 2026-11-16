import type { Piece } from "$lib/domain/entities/Piece";
import type { PanelPosition } from "$lib/domain/entities/PanelPosition";
import { PiecesRepository } from "$lib/data/repositories/PieceRepository";
import { BoardLayout } from "$lib/presentation/BoardLayout";
import { PIECE_TOKEN_CENTER_SPACING } from "$lib/presentation/constants/PieceTokenConstants";
import { PieceService } from "$lib/services/PieceService";

export function getPieceTokenOffset(index: number, count: number): number {
  return (index - (count - 1) / 2) * PIECE_TOKEN_CENTER_SPACING;
}

/** Pieces drawn in the token row of <position>; a piece in transit is drawn between panels instead. */
export function getPanelRowPieces(position: PanelPosition): Piece[] {
  return PiecesRepository.getPiecesByPosition(position).filter((piece) => !piece.isInTransit);
}

/** Board coordinates of the center of <piece>'s token as it is drawn now. */
export function getPieceTokenCoordinates(piece: Piece): { x: number; y: number } {
  const coordinates = BoardLayout.getPointCoordinates(PieceService.currentBoardPoint(piece));
  if (piece.isInTransit) return coordinates;

  const rowPieces = getPanelRowPieces(piece.panelPosition);
  const index = rowPieces.findIndex((rowPiece) => rowPiece.id === piece.id);
  return {
    x: coordinates.x + getPieceTokenOffset(index, rowPieces.length),
    y: coordinates.y,
  };
}
