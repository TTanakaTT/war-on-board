import { PieceType } from "$lib/domain/enums/PieceType";
import { m } from "$lib/paraglide/messages";

export const PIECE_TYPE_DISPLAY_ORDER = [
  PieceType.INFANTRY,
  PieceType.ROOK,
  PieceType.NOBLE,
  PieceType.ARCHER,
  PieceType.CAVALRY,
  PieceType.HEAVY,
  PieceType.SIEGE,
] as const;

const PIECE_TYPE_LABELS: Record<string, () => string> = {
  infantry: m.piece_infantry,
  rook: m.piece_rook,
  noble: m.piece_noble,
  archer: m.piece_archer,
  cavalry: m.piece_cavalry,
  heavy: m.piece_heavy,
  siege: m.piece_siege,
};

export function pieceTypeLabel(pieceType: PieceType): string {
  return PIECE_TYPE_LABELS[String(pieceType)]();
}
