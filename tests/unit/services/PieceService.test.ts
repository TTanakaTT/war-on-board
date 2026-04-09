import { beforeEach, describe, test, expect } from "vitest";
import { GameApi } from "$lib/api/GameApi";
import { PieceService } from "$lib/services/PieceService";
import { PiecesRepository } from "$lib/data/repositories/PieceRepository";
import { PanelRepository } from "$lib/data/repositories/PanelRepository";
import { Piece } from "$lib/domain/entities/Piece";
import { Panel } from "$lib/domain/entities/Panel";
import { PanelPosition } from "$lib/domain/entities/PanelPosition";
import { PieceType } from "$lib/domain/enums/PieceType";
import { Player } from "$lib/domain/enums/Player";
import {
  PASSIVE_RESOURCE_CAP,
  PASSIVE_CASTLE_CAP,
  HOME_BASE_INIT_CASTLE,
} from "$lib/domain/constants/GameConstants";

const pos = (h: number, v: number) => new PanelPosition({ horizontalLayer: h, verticalLayer: v });

const makePiece = (
  overrides: Partial<ConstructorParameters<typeof Piece>[0]> & {
    panelPosition: PanelPosition;
    player: Player;
    pieceType: PieceType;
  },
) =>
  new Piece({
    id: 0,
    ...overrides,
  });

describe("PieceService", () => {
  beforeEach(() => {
    GameApi.initializeGame({ layer: 4 });
  });

  describe("generateNextId", () => {
    test("returns 1 when no pieces exist", () => {
      expect(PieceService.generateNextId()).toBe(1);
    });

    test("returns max existing id + 1", () => {
      PiecesRepository.add(
        makePiece({
          id: 5,
          panelPosition: pos(0, 0),
          player: Player.SELF,
          pieceType: PieceType.KNIGHT,
        }),
      );
      PiecesRepository.add(
        makePiece({
          id: 3,
          panelPosition: pos(0, 1),
          player: Player.SELF,
          pieceType: PieceType.KNIGHT,
        }),
      );
      expect(PieceService.generateNextId()).toBe(6);
    });
  });

  describe("move", () => {
    test("updates piece to new position and clears targetPosition", () => {
      const piece = makePiece({
        id: 1,
        panelPosition: pos(-2, 0),
        targetPosition: pos(-1, 0),
        player: Player.SELF,
        pieceType: PieceType.KNIGHT,
      });
      PiecesRepository.add(piece);
      PieceService.move(pos(-1, 0), piece);
      const updated = PiecesRepository.getAll().find((p) => p.id === 1)!;
      expect(updated.panelPosition.equals(pos(-1, 0))).toBe(true);
      expect(updated.targetPosition).toBeUndefined();
    });

    test("sets initialPosition to new panelPosition after move", () => {
      const piece = makePiece({
        id: 1,
        panelPosition: pos(-2, 0),
        player: Player.SELF,
        pieceType: PieceType.KNIGHT,
      });
      PiecesRepository.add(piece);
      PieceService.move(pos(-1, 0), piece);
      const updated = PiecesRepository.getAll().find((p) => p.id === 1)!;
      expect(updated.initialPosition.equals(pos(-1, 0))).toBe(true);
    });

    test("preserves piece id, player, pieceType, and hp", () => {
      const piece = makePiece({
        id: 7,
        panelPosition: pos(-2, 0),
        player: Player.SELF,
        pieceType: PieceType.ROOK,
        hp: 8,
      });
      PiecesRepository.add(piece);
      PieceService.move(pos(-1, 0), piece);
      const updated = PiecesRepository.getAll().find((p) => p.id === 7)!;
      expect(updated.id).toBe(7);
      expect(updated.player).toBe(Player.SELF);
      expect(updated.pieceType).toBe(PieceType.ROOK);
      expect(updated.hp).toBe(8);
    });
  });

  describe("resetInitialPositions", () => {
    test("sets initialPosition to current panelPosition for all player pieces", () => {
      const piece = makePiece({
        id: 1,
        panelPosition: pos(-1, 0),
        initialPosition: pos(-2, 0),
        player: Player.SELF,
        pieceType: PieceType.KNIGHT,
      });
      PiecesRepository.add(piece);
      PieceService.resetInitialPositions(Player.SELF);
      const updated = PiecesRepository.getAll().find((p) => p.id === 1)!;
      expect(updated.initialPosition.equals(pos(-1, 0))).toBe(true);
    });

    test("does not affect opponent pieces", () => {
      const selfPiece = makePiece({
        id: 1,
        panelPosition: pos(-1, 0),
        initialPosition: pos(-2, 0),
        player: Player.SELF,
        pieceType: PieceType.KNIGHT,
      });
      const oppPiece = makePiece({
        id: 2,
        panelPosition: pos(1, 0),
        initialPosition: pos(2, 0),
        player: Player.OPPONENT,
        pieceType: PieceType.KNIGHT,
      });
      PiecesRepository.add(selfPiece);
      PiecesRepository.add(oppPiece);
      PieceService.resetInitialPositions(Player.SELF);
      const oppUpdated = PiecesRepository.getAll().find((p) => p.id === 2)!;
      expect(oppUpdated.initialPosition.equals(pos(2, 0))).toBe(true);
    });
  });

  describe("applyPassiveGains", () => {
    test("BISHOP increases panel resource by 1", () => {
      const bishop = makePiece({
        id: 1,
        panelPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.BISHOP,
      });
      PiecesRepository.add(bishop);
      const panel = PanelRepository.find(pos(0, 0))!;
      PanelRepository.update(new Panel({ ...panel, player: Player.SELF, resource: 0 }));
      PieceService.applyPassiveGains(Player.SELF);
      expect(PanelRepository.find(pos(0, 0))!.resource).toBe(1);
    });

    test("BISHOP resource gain is capped at PASSIVE_RESOURCE_CAP", () => {
      const bishop = makePiece({
        id: 1,
        panelPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.BISHOP,
      });
      PiecesRepository.add(bishop);
      const panel = PanelRepository.find(pos(0, 0))!;
      PanelRepository.update(
        new Panel({ ...panel, player: Player.SELF, resource: PASSIVE_RESOURCE_CAP }),
      );
      PieceService.applyPassiveGains(Player.SELF);
      expect(PanelRepository.find(pos(0, 0))!.resource).toBe(PASSIVE_RESOURCE_CAP);
    });

    test("ROOK increases panel castle by 1", () => {
      const rook = makePiece({
        id: 1,
        panelPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.ROOK,
      });
      PiecesRepository.add(rook);
      const panel = PanelRepository.find(pos(0, 0))!;
      PanelRepository.update(new Panel({ ...panel, player: Player.SELF, castle: 0 }));
      PieceService.applyPassiveGains(Player.SELF);
      expect(PanelRepository.find(pos(0, 0))!.castle).toBe(1);
    });

    test("ROOK castle gain is capped at PASSIVE_CASTLE_CAP", () => {
      const rook = makePiece({
        id: 1,
        panelPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.ROOK,
      });
      PiecesRepository.add(rook);
      const panel = PanelRepository.find(pos(0, 0))!;
      PanelRepository.update(
        new Panel({ ...panel, player: Player.SELF, castle: PASSIVE_CASTLE_CAP }),
      );
      PieceService.applyPassiveGains(Player.SELF);
      expect(PanelRepository.find(pos(0, 0))!.castle).toBe(PASSIVE_CASTLE_CAP);
    });

    test("ROOK preserves existing castle value above cap", () => {
      const rook = makePiece({
        id: 1,
        panelPosition: pos(-3, 0),
        player: Player.SELF,
        pieceType: PieceType.ROOK,
      });
      PiecesRepository.add(rook);
      // Home base castle = HOME_BASE_INIT_CASTLE (10) which is above PASSIVE_CASTLE_CAP (5)
      const panel = PanelRepository.find(pos(-3, 0))!;
      expect(panel.castle).toBe(HOME_BASE_INIT_CASTLE);
      PieceService.applyPassiveGains(Player.SELF);
      expect(PanelRepository.find(pos(-3, 0))!.castle).toBe(HOME_BASE_INIT_CASTLE);
    });

    test("KNIGHT sets panel player to piece owner", () => {
      const knight = makePiece({
        id: 1,
        panelPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.KNIGHT,
      });
      PiecesRepository.add(knight);
      const panel = PanelRepository.find(pos(0, 0))!;
      expect(panel.player).toBe(Player.UNKNOWN);
      PieceService.applyPassiveGains(Player.SELF);
      expect(PanelRepository.find(pos(0, 0))!.player).toBe(Player.SELF);
    });

    test("skips piece when panel is not found", () => {
      // Piece at a position not on the board - should not throw
      const piece = makePiece({
        id: 1,
        panelPosition: pos(99, 99),
        player: Player.SELF,
        pieceType: PieceType.KNIGHT,
      });
      PiecesRepository.add(piece);
      expect(() => PieceService.applyPassiveGains(Player.SELF)).not.toThrow();
    });
  });

  describe("finalizePlayerMoves", () => {
    test("returns empty array when no pieces have pending moves", () => {
      const piece = makePiece({
        id: 1,
        panelPosition: pos(-2, 0),
        player: Player.SELF,
        pieceType: PieceType.KNIGHT,
      });
      PiecesRepository.add(piece);
      const outcomes = PieceService.finalizePlayerMoves(Player.SELF);
      expect(outcomes).toEqual([]);
    });

    test("moves piece to target panel when target is unoccupied", () => {
      const piece = makePiece({
        id: 1,
        panelPosition: pos(-2, 0),
        targetPosition: pos(-1, 0),
        player: Player.SELF,
        pieceType: PieceType.KNIGHT,
      });
      PiecesRepository.add(piece);
      const outcomes = PieceService.finalizePlayerMoves(Player.SELF);
      // No combat on empty panel
      expect(outcomes).toEqual([]);
      const moved = PiecesRepository.getAll().find((p) => p.id === 1)!;
      expect(moved.panelPosition.equals(pos(-1, 0))).toBe(true);
    });

    test("resolves combat when target has enemy pieces", () => {
      const attacker = makePiece({
        id: 1,
        panelPosition: pos(-1, 0),
        targetPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.KNIGHT,
      });
      const defender = makePiece({
        id: 2,
        panelPosition: pos(0, 0),
        player: Player.OPPONENT,
        pieceType: PieceType.KNIGHT,
      });
      PiecesRepository.add(attacker);
      PiecesRepository.add(defender);
      const outcomes = PieceService.finalizePlayerMoves(Player.SELF);
      expect(outcomes.length).toBe(1);
      expect(outcomes[0].targetPosition.horizontalLayer).toBe(0);
      expect(outcomes[0].targetPosition.verticalLayer).toBe(0);
    });

    test("attacks wall first when target panel has castle > 0", () => {
      const panel = PanelRepository.find(pos(0, 0))!;
      PanelRepository.update(new Panel({ ...panel, player: Player.OPPONENT, castle: 3 }));
      const attacker = makePiece({
        id: 1,
        panelPosition: pos(-1, 0),
        targetPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.KNIGHT,
      });
      PiecesRepository.add(attacker);
      const outcomes = PieceService.finalizePlayerMoves(Player.SELF);
      expect(outcomes.length).toBe(1);
      expect(outcomes[0].wallDamageDealt).toBeGreaterThan(0);
      expect(outcomes[0].entered).toBe(false);
    });

    test("groups multiple attackers targeting the same panel", () => {
      const a1 = makePiece({
        id: 1,
        panelPosition: pos(-1, 0),
        targetPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.KNIGHT,
      });
      const a2 = makePiece({
        id: 2,
        panelPosition: pos(0, 1),
        targetPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.KNIGHT,
      });
      const defender = makePiece({
        id: 3,
        panelPosition: pos(0, 0),
        player: Player.OPPONENT,
        pieceType: PieceType.KNIGHT,
      });
      PiecesRepository.add(a1);
      PiecesRepository.add(a2);
      PiecesRepository.add(defender);
      const outcomes = PieceService.finalizePlayerMoves(Player.SELF);
      // Both attackers target same panel, so only 1 outcome
      expect(outcomes.length).toBe(1);
    });
  });
});
