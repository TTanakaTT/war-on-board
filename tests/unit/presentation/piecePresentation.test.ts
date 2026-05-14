import { describe, expect, test } from "vitest";
import { PieceType } from "$lib/domain/enums/PieceType";
import { m } from "$lib/paraglide/messages";
import { PIECE_TYPE_DISPLAY_ORDER, pieceTypeLabel } from "$lib/presentation/piecePresentation";

describe("piecePresentation", () => {
  test("returns localized labels for each piece type", () => {
    expect(pieceTypeLabel(PieceType.KNIGHT)).toBe(m.piece_knight());
    expect(pieceTypeLabel(PieceType.ROOK)).toBe(m.piece_rook());
    expect(pieceTypeLabel(PieceType.BISHOP)).toBe(m.piece_bishop());
  });

  test("keeps the display order stable for piece summaries", () => {
    expect(PIECE_TYPE_DISPLAY_ORDER).toEqual([PieceType.KNIGHT, PieceType.ROOK, PieceType.BISHOP]);
  });
});
