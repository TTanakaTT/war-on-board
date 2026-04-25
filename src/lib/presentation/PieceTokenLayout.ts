import { PIECE_TOKEN_CENTER_SPACING } from "$lib/presentation/constants/PieceTokenConstants";

export function getPieceTokenOffset(index: number, count: number): number {
  return (index - (count - 1) / 2) * PIECE_TOKEN_CENTER_SPACING;
}
