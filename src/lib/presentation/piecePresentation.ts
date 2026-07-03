import { PieceType } from "$lib/domain/enums/PieceType";
import { m } from "$lib/paraglide/messages";

export const PIECE_TYPE_DISPLAY_ORDER = [
  PieceType.INFANTRY,
  PieceType.ROOK,
  PieceType.NOBLE,
] as const;

export function pieceTypeLabel(pieceType: PieceType): string {
  if (pieceType === PieceType.INFANTRY) {
    return m.piece_infantry();
  }

  if (pieceType === PieceType.ROOK) {
    return m.piece_rook();
  }

  return m.piece_noble();
}
