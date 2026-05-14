import { PieceType } from "$lib/domain/enums/PieceType";
import { m } from "$lib/paraglide/messages";

export const PIECE_TYPE_DISPLAY_ORDER = [
  PieceType.KNIGHT,
  PieceType.ROOK,
  PieceType.BISHOP,
] as const;

export function pieceTypeLabel(pieceType: PieceType): string {
  if (pieceType === PieceType.KNIGHT) {
    return m.piece_knight();
  }

  if (pieceType === PieceType.ROOK) {
    return m.piece_rook();
  }

  return m.piece_bishop();
}
