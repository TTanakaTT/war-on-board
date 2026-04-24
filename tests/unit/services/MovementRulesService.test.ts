import { describe, test, expect, beforeEach } from "vitest";
import { MovementRulesService } from "$lib/services/MovementRulesService";
import { GameApi } from "$lib/api/GameApi";
import { PiecesRepository } from "$lib/data/repositories/PieceRepository";
import { PanelRepository } from "$lib/data/repositories/PanelRepository";
import { Piece } from "$lib/domain/entities/Piece";
import { Panel } from "$lib/domain/entities/Panel";
import { PanelPosition } from "$lib/domain/entities/PanelPosition";
import { PieceType } from "$lib/domain/enums/PieceType";
import { Player } from "$lib/domain/enums/Player";

const pos = (h: number, v: number) => new PanelPosition({ horizontalLayer: h, verticalLayer: v });

function addPiece(
  id: number,
  position: PanelPosition,
  player: Player,
  opts: { pieceType?: PieceType; targetPosition?: PanelPosition } = {},
): Piece {
  const piece = new Piece({
    id,
    panelPosition: position,
    player,
    pieceType: opts.pieceType ?? PieceType.KNIGHT,
    targetPosition: opts.targetPosition,
  });
  PiecesRepository.add(piece);
  return piece;
}

function setPanel(position: PanelPosition, player: Player, castle: number = 0) {
  const existing = PanelRepository.find(position);
  if (existing) {
    PanelRepository.update(
      new Panel({
        panelPosition: position,
        panelState: existing.panelState,
        player,
        castle,
      }),
    );
  }
}

describe("MovementRulesService", () => {
  beforeEach(() => {
    GameApi.initializeGame({ layer: 5 });
  });

  describe("hasEnemyPresence", () => {
    test("returns true when enemy pieces occupy the position", () => {
      addPiece(100, pos(1, 0), Player.OPPONENT);
      expect(MovementRulesService.hasEnemyPresence(pos(1, 0), Player.SELF)).toBe(true);
    });

    test("returns true when enemy-owned castle exists (no enemy pieces)", () => {
      setPanel(pos(1, 0), Player.OPPONENT, 5);
      expect(MovementRulesService.hasEnemyPresence(pos(1, 0), Player.SELF)).toBe(true);
    });

    test("returns false for panel with only friendly pieces", () => {
      addPiece(100, pos(1, 0), Player.SELF);
      expect(MovementRulesService.hasEnemyPresence(pos(1, 0), Player.SELF)).toBe(false);
    });

    test("returns false for neutral (UNKNOWN) panel with no pieces", () => {
      expect(MovementRulesService.hasEnemyPresence(pos(1, 0), Player.SELF)).toBe(false);
    });
  });

  describe("projectedFriendlyCount", () => {
    test("counts pieces at current position when no move is assigned", () => {
      addPiece(100, pos(0, 0), Player.SELF);
      addPiece(101, pos(0, 0), Player.SELF);
      expect(MovementRulesService.projectedFriendlyCount(pos(0, 0), Player.SELF)).toBe(2);
    });

    test("counts pieces at target position when target is friendly", () => {
      // Piece at (0,0) targeting (1,0) — no enemy at (1,0), so projected at (1,0)
      addPiece(100, pos(0, 0), Player.SELF, { targetPosition: pos(1, 0) });
      expect(MovementRulesService.projectedFriendlyCount(pos(1, 0), Player.SELF)).toBe(1);
      expect(MovementRulesService.projectedFriendlyCount(pos(0, 0), Player.SELF)).toBe(0);
    });

    test("counts pieces at current position when target is enemy (conservative)", () => {
      // Piece targeting an enemy panel — counted at current position conservatively
      addPiece(100, pos(0, 0), Player.SELF, { targetPosition: pos(1, 0) });
      addPiece(200, pos(1, 0), Player.OPPONENT); // enemy at target
      expect(MovementRulesService.projectedFriendlyCount(pos(0, 0), Player.SELF)).toBe(1);
      expect(MovementRulesService.projectedFriendlyCount(pos(1, 0), Player.SELF)).toBe(0);
    });

    test("excludes the piece specified by excludePieceId", () => {
      addPiece(100, pos(0, 0), Player.SELF);
      addPiece(101, pos(0, 0), Player.SELF);
      expect(MovementRulesService.projectedFriendlyCount(pos(0, 0), Player.SELF, 100)).toBe(1);
    });
  });

  describe("projectedFriendlyStackCount", () => {
    test("counts multiple incoming mergeable pieces of the same type as one projected stack", () => {
      addPiece(100, pos(0, 0), Player.SELF, {
        pieceType: PieceType.KNIGHT,
        targetPosition: pos(1, 0),
      });
      addPiece(101, pos(0, 1), Player.SELF, {
        pieceType: PieceType.ROOK,
        targetPosition: pos(1, 0),
      });
      addPiece(102, pos(1, 1), Player.SELF, { pieceType: PieceType.KNIGHT });

      expect(MovementRulesService.projectedFriendlyStackCount(pos(1, 0), Player.SELF)).toBe(2);
    });
  });

  describe("canMoveTo", () => {
    test("allows move to enemy panel regardless of capacity", () => {
      // Fill the target with max friendly pieces, but enemy present → still allowed
      addPiece(100, pos(1, 0), Player.SELF);
      addPiece(101, pos(1, 0), Player.SELF);
      addPiece(200, pos(1, 0), Player.OPPONENT); // enemy presence
      const piece = addPiece(300, pos(0, 0), Player.SELF);
      expect(MovementRulesService.canMoveTo(pos(1, 0), Player.SELF, piece.id)).toBe(true);
    });

    test("allows move to friendly panel when projected count is within capacity", () => {
      addPiece(100, pos(1, 0), Player.SELF); // 1 friendly at target
      const piece = addPiece(200, pos(0, 0), Player.SELF);
      // projected count at (1,0) = 1, + 1 = 2 <= DEFAULT_MAX_PIECES_PER_PANEL(2)
      expect(MovementRulesService.canMoveTo(pos(1, 0), Player.SELF, piece.id)).toBe(true);
    });

    test("blocks move to friendly panel when projected count exceeds capacity", () => {
      addPiece(100, pos(1, 0), Player.SELF, { pieceType: PieceType.ROOK });
      addPiece(101, pos(1, 0), Player.SELF, { pieceType: PieceType.BISHOP });
      const piece = addPiece(200, pos(0, 0), Player.SELF);
      // projected count at (1,0) = 2, + 1 = 3 > DEFAULT_MAX_PIECES_PER_PANEL(2), and no merge target exists
      expect(MovementRulesService.canMoveTo(pos(1, 0), Player.SELF, piece.id)).toBe(false);
    });

    test("allows move to full friendly panel when moving piece can merge with a resident friendly piece", () => {
      addPiece(100, pos(1, 0), Player.SELF, { pieceType: PieceType.KNIGHT });
      addPiece(101, pos(1, 0), Player.SELF, { pieceType: PieceType.ROOK });
      const piece = addPiece(200, pos(0, 0), Player.SELF, { pieceType: PieceType.KNIGHT });

      expect(MovementRulesService.canMoveTo(pos(1, 0), Player.SELF, piece.id)).toBe(true);
    });

    test("allows move when target has one resident piece and two incoming mergeable pieces collapse into one stack", () => {
      addPiece(100, pos(1, 0), Player.SELF, { pieceType: PieceType.ROOK });
      addPiece(101, pos(0, 1), Player.SELF, {
        pieceType: PieceType.KNIGHT,
        targetPosition: pos(1, 0),
      });
      const piece = addPiece(200, pos(0, 0), Player.SELF, { pieceType: PieceType.KNIGHT });

      expect(MovementRulesService.canMoveTo(pos(1, 0), Player.SELF, piece.id)).toBe(true);
    });

    test("allows move when target is empty and two incoming mergeable pieces share one stack with another incoming piece", () => {
      addPiece(100, pos(0, 1), Player.SELF, {
        pieceType: PieceType.KNIGHT,
        targetPosition: pos(1, 0),
      });
      addPiece(101, pos(1, 1), Player.SELF, {
        pieceType: PieceType.ROOK,
        targetPosition: pos(1, 0),
      });
      const piece = addPiece(200, pos(0, 0), Player.SELF, { pieceType: PieceType.KNIGHT });

      expect(MovementRulesService.canMoveTo(pos(1, 0), Player.SELF, piece.id)).toBe(true);
    });

    test("blocks move to full friendly panel when no resident friendly piece can merge", () => {
      addPiece(100, pos(1, 0), Player.SELF, { pieceType: PieceType.ROOK });
      addPiece(101, pos(1, 0), Player.SELF, { pieceType: PieceType.BISHOP });
      const piece = addPiece(200, pos(0, 0), Player.SELF, { pieceType: PieceType.KNIGHT });

      expect(MovementRulesService.canMoveTo(pos(1, 0), Player.SELF, piece.id)).toBe(false);
    });

    test("piece with 0 attack power cannot move to enemy panel", () => {
      const bishop = new Piece({
        id: 1,
        panelPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.BISHOP,
      });
      PiecesRepository.add(bishop);
      addPiece(50, pos(1, 0), Player.OPPONENT);
      expect(MovementRulesService.canMoveTo(pos(1, 0), Player.SELF, bishop.id)).toBe(false);
    });

    test("piece with attack power > 0 can move to enemy panel", () => {
      const knight = addPiece(1, pos(0, 0), Player.SELF);
      addPiece(50, pos(1, 0), Player.OPPONENT);
      expect(MovementRulesService.canMoveTo(pos(1, 0), Player.SELF, knight.id)).toBe(true);
    });
  });

  describe("canCancelMove", () => {
    test("allows cancel when returning piece keeps current panel within capacity", () => {
      // piece at (0,0) with target (1,0). current panel (0,0) has 1 other piece.
      addPiece(100, pos(0, 0), Player.SELF);
      const piece = addPiece(200, pos(0, 0), Player.SELF, { targetPosition: pos(1, 0) });
      // projected at (0,0) without piece 200: counts other(100) at (0,0) = 1; +1 = 2 <= 2
      expect(MovementRulesService.canCancelMove(pos(0, 0), Player.SELF, piece.id)).toBe(true);
    });

    test("blocks cancel when returning piece would exceed current panel capacity", () => {
      // 2 pieces already projected at (0,0), plus the cancelling piece would make 3
      addPiece(100, pos(0, 0), Player.SELF);
      addPiece(101, pos(0, 0), Player.SELF);
      const piece = addPiece(200, pos(0, 0), Player.SELF, { targetPosition: pos(1, 0) });
      // projected at (0,0) without piece 200: counts 100 + 101 = 2; +1 = 3 > 2
      expect(MovementRulesService.canCancelMove(pos(0, 0), Player.SELF, piece.id)).toBe(false);
    });
  });
});
