import { describe, expect, test } from "vitest";
import { PieceType } from "$lib/domain/enums/PieceType";
import { m } from "$lib/paraglide/messages";
import { PIECE_TYPE_DISPLAY_ORDER, pieceTypeLabel } from "$lib/presentation/piecePresentation";

describe("piecePresentation", () => {
  test("returns localized labels for each piece type", () => {
    expect(pieceTypeLabel(PieceType.INFANTRY)).toBe(m.piece_infantry());
    expect(pieceTypeLabel(PieceType.ROOK)).toBe(m.piece_rook());
    expect(pieceTypeLabel(PieceType.NOBLE)).toBe(m.piece_noble());
    expect(pieceTypeLabel(PieceType.ARCHER)).toBe(m.piece_archer());
    expect(pieceTypeLabel(PieceType.CAVALRY)).toBe(m.piece_cavalry());
    expect(pieceTypeLabel(PieceType.HEAVY)).toBe(m.piece_heavy());
    expect(pieceTypeLabel(PieceType.SIEGE)).toBe(m.piece_siege());
  });

  test("keeps the display order stable for piece summaries", () => {
    expect(PIECE_TYPE_DISPLAY_ORDER).toEqual([
      PieceType.INFANTRY,
      PieceType.ROOK,
      PieceType.NOBLE,
      PieceType.ARCHER,
      PieceType.CAVALRY,
      PieceType.HEAVY,
      PieceType.SIEGE,
    ]);
  });
});
