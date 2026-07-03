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
    pieceType: opts.pieceType ?? PieceType.INFANTRY,
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

  describe("projectedFriendlyStackCount", () => {
    test("counts multiple incoming mergeable pieces of the same type as one projected stack", () => {
      addPiece(100, pos(0, 0), Player.SELF, {
        pieceType: PieceType.INFANTRY,
        targetPosition: pos(1, 0),
      });
      addPiece(101, pos(0, 1), Player.SELF, {
        pieceType: PieceType.ROOK,
        targetPosition: pos(1, 0),
      });
      addPiece(102, pos(1, 1), Player.SELF, { pieceType: PieceType.INFANTRY });

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
      addPiece(101, pos(1, 0), Player.SELF, { pieceType: PieceType.NOBLE });
      const piece = addPiece(200, pos(0, 0), Player.SELF);
      // projected count at (1,0) = 2, + 1 = 3 > DEFAULT_MAX_PIECES_PER_PANEL(2), and no merge target exists
      expect(MovementRulesService.canMoveTo(pos(1, 0), Player.SELF, piece.id)).toBe(false);
    });

    test("allows move to full friendly panel when moving piece can merge with a resident friendly piece", () => {
      addPiece(100, pos(1, 0), Player.SELF, { pieceType: PieceType.INFANTRY });
      addPiece(101, pos(1, 0), Player.SELF, { pieceType: PieceType.ROOK });
      const piece = addPiece(200, pos(0, 0), Player.SELF, { pieceType: PieceType.INFANTRY });

      expect(MovementRulesService.canMoveTo(pos(1, 0), Player.SELF, piece.id)).toBe(true);
    });

    test("allows move when target has one resident piece and two incoming mergeable pieces collapse into one stack", () => {
      addPiece(100, pos(1, 0), Player.SELF, { pieceType: PieceType.ROOK });
      addPiece(101, pos(0, 1), Player.SELF, {
        pieceType: PieceType.INFANTRY,
        targetPosition: pos(1, 0),
      });
      const piece = addPiece(200, pos(0, 0), Player.SELF, { pieceType: PieceType.INFANTRY });

      expect(MovementRulesService.canMoveTo(pos(1, 0), Player.SELF, piece.id)).toBe(true);
    });

    test("allows move when target is empty and two incoming mergeable pieces share one stack with another incoming piece", () => {
      addPiece(100, pos(0, 1), Player.SELF, {
        pieceType: PieceType.INFANTRY,
        targetPosition: pos(1, 0),
      });
      addPiece(101, pos(1, 1), Player.SELF, {
        pieceType: PieceType.ROOK,
        targetPosition: pos(1, 0),
      });
      const piece = addPiece(200, pos(0, 0), Player.SELF, { pieceType: PieceType.INFANTRY });

      expect(MovementRulesService.canMoveTo(pos(1, 0), Player.SELF, piece.id)).toBe(true);
    });

    test("allows stay move on a full panel when mergeable resident pieces collapse into one stack", () => {
      const selectedPiece = addPiece(100, pos(1, 0), Player.SELF, {
        pieceType: PieceType.INFANTRY,
      });
      addPiece(101, pos(1, 0), Player.SELF, { pieceType: PieceType.INFANTRY });
      addPiece(102, pos(1, 0), Player.SELF, { pieceType: PieceType.ROOK });

      expect(MovementRulesService.canMoveTo(pos(1, 0), Player.SELF, selectedPiece.id)).toBe(true);
    });

    test("blocks move to full friendly panel when no resident friendly piece can merge", () => {
      addPiece(100, pos(1, 0), Player.SELF, { pieceType: PieceType.ROOK });
      addPiece(101, pos(1, 0), Player.SELF, { pieceType: PieceType.NOBLE });
      const piece = addPiece(200, pos(0, 0), Player.SELF, { pieceType: PieceType.INFANTRY });

      expect(MovementRulesService.canMoveTo(pos(1, 0), Player.SELF, piece.id)).toBe(false);
    });

    test("piece with 0 attack power cannot move to enemy panel", () => {
      const noble = new Piece({
        id: 1,
        panelPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.NOBLE,
      });
      PiecesRepository.add(noble);
      addPiece(50, pos(1, 0), Player.OPPONENT);
      expect(MovementRulesService.canMoveTo(pos(1, 0), Player.SELF, noble.id)).toBe(false);
    });

    test("piece with attack power > 0 can move to enemy panel", () => {
      const infantry = addPiece(1, pos(0, 0), Player.SELF);
      addPiece(50, pos(1, 0), Player.OPPONENT);
      expect(MovementRulesService.canMoveTo(pos(1, 0), Player.SELF, infantry.id)).toBe(true);
    });

    test("blocks move to enemy panel when a defender's defense exceeds the attacker's raw attack power", () => {
      const attacker = addPiece(1, pos(0, 0), Player.SELF, { pieceType: PieceType.ROOK }); // atk=2
      // No shipped unit type currently has defense > 2, so exercise the gate directly at the
      // MovementRulesService level with a hand-built defender. This is a canary for Phase E,
      // when Heavy (defense=2) and Siege Engine (defense=3) land.
      const highDefenseDefender = new Piece({
        id: 50,
        panelPosition: pos(1, 0),
        player: Player.OPPONENT,
        pieceType: PieceType.NOBLE,
      });
      Object.defineProperty(highDefenseDefender, "defense", { value: 3 });
      expect(MovementRulesService.canDefeatAllDefenders(attacker, [highDefenseDefender])).toBe(
        false,
      );
    });

    test("allows attack when defender's defense equals the attacker's raw attack power (boundary)", () => {
      const attacker = addPiece(1, pos(0, 0), Player.SELF, { pieceType: PieceType.ROOK }); // atk=2
      const defender = addPiece(50, pos(1, 0), Player.OPPONENT, { pieceType: PieceType.ROOK }); // def=1
      expect(MovementRulesService.canDefeatAllDefenders(attacker, [defender])).toBe(true);
      expect(MovementRulesService.canMoveTo(pos(1, 0), Player.SELF, attacker.id)).toBe(true);
    });

    test("merge (stackCount) never affects the defense gate — only the raw config attack power counts", () => {
      const mergedAttacker = new Piece({
        id: 1,
        panelPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.ROOK, // atk=2
        stackCount: 3,
      });
      const highDefenseDefender = new Piece({
        id: 50,
        panelPosition: pos(1, 0),
        player: Player.OPPONENT,
        pieceType: PieceType.NOBLE,
      });
      Object.defineProperty(highDefenseDefender, "defense", { value: 3 });
      expect(
        MovementRulesService.canDefeatAllDefenders(mergedAttacker, [highDefenseDefender]),
      ).toBe(false);
    });

    test("wall-only panel (no defending pieces) is never gated by the defense check", () => {
      const attacker = addPiece(1, pos(0, 0), Player.SELF, { pieceType: PieceType.NOBLE }); // atk=0, but canAttack is false anyway
      setPanel(pos(1, 0), Player.OPPONENT, 5);
      const wallAttacker = addPiece(2, pos(0, 1), Player.SELF, { pieceType: PieceType.ROOK });
      expect(MovementRulesService.canMoveTo(pos(1, 0), Player.SELF, wallAttacker.id)).toBe(true);
      expect(attacker.canAttack).toBe(false); // sanity: unrelated to the wall-only assertion above
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
      addPiece(100, pos(0, 0), Player.SELF, { pieceType: PieceType.ROOK });
      addPiece(101, pos(0, 0), Player.SELF, { pieceType: PieceType.NOBLE });
      const piece = addPiece(200, pos(0, 0), Player.SELF, {
        pieceType: PieceType.INFANTRY,
        targetPosition: pos(1, 0),
      });
      // projected stack count at (0,0) without piece 200 is 2; including it makes 3 > 2
      expect(MovementRulesService.canCancelMove(pos(0, 0), Player.SELF, piece.id)).toBe(false);
    });

    test("allows cancel when returning mergeable piece collapses into an existing stack on a full panel", () => {
      addPiece(100, pos(0, 0), Player.SELF, { pieceType: PieceType.INFANTRY });
      addPiece(101, pos(0, 0), Player.SELF, { pieceType: PieceType.ROOK });
      const piece = addPiece(200, pos(0, 0), Player.SELF, {
        pieceType: PieceType.INFANTRY,
        targetPosition: pos(1, 0),
      });

      expect(MovementRulesService.canCancelMove(pos(0, 0), Player.SELF, piece.id)).toBe(true);
    });

    test("blocks cancel unconditionally for a movement<1 piece with a pending target, even within capacity", () => {
      // Synthetic movement<1 piece type (future Heavy-like unit) — committed actions can
      // never be cancelled, regardless of capacity headroom.
      const slowPieceType = {
        config: { ...PieceType.INFANTRY.config, movement: 0.5 },
      } as unknown as PieceType;
      const piece = addPiece(200, pos(0, 0), Player.SELF, {
        pieceType: slowPieceType,
        targetPosition: pos(1, 0),
      });

      expect(MovementRulesService.canCancelMove(pos(0, 0), Player.SELF, piece.id)).toBe(false);
    });
  });
});
