import { beforeEach, describe, expect, test } from "vitest";
import { GameApi } from "#lib/api/GameApi.ts";
import { PanelRepository, PiecesRepository, SelectionRepository } from "#lib/store.svelte.ts";
import {
  type PanelPosition,
  PanelState,
  type Piece,
  PieceType,
  Player,
  pos,
  samePos,
  createPiece,
} from "#lib/domain/model.ts";
import { InteractionService } from "#lib/services/InteractionService.ts";
import { PanelsService } from "#lib/services/PanelService.ts";

function setupSelfPiece(position: PanelPosition, id = 1): Piece {
  const piece = createPiece({
    id,
    panelPosition: position,
    initialPosition: position,
    player: Player.SELF,
    pieceType: PieceType.INFANTRY,
  });
  PiecesRepository.add(piece);
  return piece;
}

function setupSelfArcher(position: PanelPosition, id = 1): Piece {
  const piece = createPiece({
    id,
    panelPosition: position,
    initialPosition: position,
    player: Player.SELF,
    pieceType: PieceType.ARCHER,
  });
  PiecesRepository.add(piece);
  return piece;
}

function getPiece(id: number): Piece {
  const piece = PiecesRepository.getAll().find((currentPiece) => currentPiece.id === id);

  if (!piece) {
    throw new Error(`Piece ${id} not found`);
  }

  return piece;
}

describe("InteractionService", () => {
  beforeEach(() => {
    GameApi.initializeGame({ layer: 4 });
    SelectionRepository.setPieceId(undefined);
  });

  describe("pieceChange", () => {
    test("reselects a piece with a pending move instead of cancelling immediately", () => {
      setupSelfPiece(pos(0, 0));
      const target = pos(0, 1);

      GameApi.assignMove(Player.SELF, 1, target);
      InteractionService.pieceChange(getPiece(1));

      expect(samePos(getPiece(1).targetPosition, target)).toBe(true);
      expect(SelectionRepository.getPieceId()).toBe(1);
      expect(PanelRepository.find(pos(0, 0))?.panelState).toBe(PanelState.SELECTED);
      expect(PanelRepository.find(target)?.panelState).toBe(PanelState.MOVABLE);
    });
  });

  describe("selection state", () => {
    const hasHighlight = () =>
      PanelRepository.getAll().some(
        (p) => p.panelState === PanelState.SELECTED || p.panelState === PanelState.MOVABLE,
      );

    test("selecting the same piece twice cancels the selection", () => {
      setupSelfPiece(pos(0, 0));

      InteractionService.pieceChange(getPiece(1));
      InteractionService.pieceChange(getPiece(1));

      expect(SelectionRepository.getPieceId()).toBeUndefined();
      expect(hasHighlight()).toBe(false);
    });

    test("selecting another piece switches the selection", () => {
      setupSelfPiece(pos(0, 0));
      setupSelfPiece(pos(0, 1), 2);

      InteractionService.pieceChange(getPiece(1));
      InteractionService.pieceChange(getPiece(2));

      expect(SelectionRepository.getPieceId()).toBe(2);
      expect(PanelRepository.find(pos(0, 1))?.panelState).toBe(PanelState.SELECTED);
      expect(PanelRepository.find(pos(0, 0))?.panelState).not.toBe(PanelState.SELECTED);
    });

    test("selecting another piece on the same panel switches the selection", () => {
      setupSelfPiece(pos(0, 0));
      setupSelfPiece(pos(0, 0), 2);

      InteractionService.pieceChange(getPiece(1));
      InteractionService.pieceChange(getPiece(2));

      expect(SelectionRepository.getPieceId()).toBe(2);
      expect(PanelRepository.find(pos(0, 0))?.panelState).toBe(PanelState.SELECTED);
    });

    test("clicking the SELECTED panel background clears the selected piece id", () => {
      setupSelfPiece(pos(0, 0));

      InteractionService.pieceChange(getPiece(1));
      InteractionService.panelChange(pos(0, 0));

      expect(SelectionRepository.getPieceId()).toBeUndefined();
      expect(hasHighlight()).toBe(false);
    });

    test("assigning a move clears the selected piece id", () => {
      setupSelfPiece(pos(0, 0));

      InteractionService.pieceChange(getPiece(1));
      InteractionService.panelChange(pos(0, 1));

      expect(samePos(getPiece(1).targetPosition, pos(0, 1))).toBe(true);
      expect(SelectionRepository.getPieceId()).toBeUndefined();
    });
  });

  describe("panelChange", () => {
    test("OCCUPIED background click selects the first unreserved own piece", () => {
      setupSelfPiece(pos(0, 0));
      setupSelfPiece(pos(0, 0), 2);
      GameApi.assignMove(Player.SELF, 1, pos(0, 1));
      PanelsService.refreshPanelStates();

      InteractionService.panelChange(pos(0, 0));

      expect(SelectionRepository.getPieceId()).toBe(2);
    });

    test("OCCUPIED background click selects the first reserved piece when all are reserved", () => {
      setupSelfPiece(pos(0, 0));
      setupSelfPiece(pos(0, 0), 2);
      GameApi.assignMove(Player.SELF, 1, pos(0, 1));
      GameApi.assignMove(Player.SELF, 2, pos(1, 0));
      PanelsService.refreshPanelStates();

      InteractionService.panelChange(pos(0, 0));

      expect(SelectionRepository.getPieceId()).toBe(1);
    });

    test("OCCUPIED background click does nothing for opponent-only panels", () => {
      PiecesRepository.add(
        createPiece({
          id: 1,
          panelPosition: pos(0, 0),
          initialPosition: pos(0, 0),
          player: Player.OPPONENT,
          pieceType: PieceType.INFANTRY,
        }),
      );
      PanelsService.refreshPanelStates();

      InteractionService.panelChange(pos(0, 0));

      expect(SelectionRepository.getPieceId()).toBeUndefined();
    });

    test("cancels a pending move when the selected source panel is clicked", () => {
      setupSelfPiece(pos(0, 0));
      const source = pos(0, 0);
      const target = pos(0, 1);

      GameApi.assignMove(Player.SELF, 1, target);
      InteractionService.pieceChange(getPiece(1));
      InteractionService.panelChange(source);

      expect(getPiece(1).targetPosition).toBeUndefined();
      expect(SelectionRepository.getPieceId()).toBeUndefined();
      expect(PanelRepository.find(source)?.panelState).toBe(PanelState.OCCUPIED);
    });

    test("reassigns a pending move when another movable panel is clicked after reselection", () => {
      setupSelfPiece(pos(0, 0));
      const firstTarget = pos(0, 1);
      const nextTarget = pos(1, 0);

      GameApi.assignMove(Player.SELF, 1, firstTarget);
      InteractionService.pieceChange(getPiece(1));
      InteractionService.panelChange(nextTarget);

      expect(samePos(getPiece(1).targetPosition, nextTarget)).toBe(true);
      expect(PanelRepository.find(pos(0, 0))?.panelState).toBe(PanelState.OCCUPIED);
    });
  });

  describe("highlightMovableFromOccupied — distant targets", () => {
    test("marks a distant (non-adjacent) empty panel as MOVABLE", () => {
      setupSelfPiece(pos(-3, 0));
      PanelsService.refreshPanelStates();
      const distantTarget = pos(0, 0);

      InteractionService.pieceChange(getPiece(1));

      expect(PanelRepository.find(distantTarget)?.panelState).toBe(PanelState.MOVABLE);
    });

    test("leaves an adjacent enemy panel unchanged when canMoveTo disallows it (piece cannot attack at all)", () => {
      setupSelfPiece(pos(-3, 0));
      const noble = getPiece(1);
      // A noble's movement points must be its own (the piece was built as an infantry).
      PiecesRepository.update(
        createPiece({ ...noble, pieceType: PieceType.NOBLE, movementPoints: 1 }),
      );

      const adjacentEnemyPosition = pos(-2, 0);
      PiecesRepository.add(
        createPiece({
          id: 2,
          panelPosition: adjacentEnemyPosition,
          initialPosition: adjacentEnemyPosition,
          player: Player.OPPONENT,
          pieceType: PieceType.INFANTRY,
        }),
      );
      PanelsService.refreshPanelStates();

      InteractionService.pieceChange(getPiece(1));

      const panelState = PanelRepository.find(adjacentEnemyPosition)?.panelState;
      expect(panelState).not.toBe(PanelState.MOVABLE);
    });

    test("marks a distant enemy panel MOVABLE even for a piece that cannot attack (a distant target can always be ordered)", () => {
      setupSelfPiece(pos(-3, 0));
      const noble = getPiece(1);
      PiecesRepository.update(
        createPiece({ ...noble, pieceType: PieceType.NOBLE, movementPoints: 1 }),
      );

      const distantEnemyPosition = pos(0, 0);
      PiecesRepository.add(
        createPiece({
          id: 2,
          panelPosition: distantEnemyPosition,
          initialPosition: distantEnemyPosition,
          player: Player.OPPONENT,
          pieceType: PieceType.INFANTRY,
        }),
      );
      PanelsService.refreshPanelStates();

      InteractionService.pieceChange(getPiece(1));

      expect(PanelRepository.find(distantEnemyPosition)?.panelState).toBe(PanelState.MOVABLE);
    });
  });

  describe("ranged attack mode", () => {
    test("toggleRangedAttackMode does nothing when no piece is selected", () => {
      InteractionService.toggleRangedAttackMode();
      expect(SelectionRepository.isRangedAttackMode()).toBe(false);
    });

    test("panelChange fires assignRangedAttack when attack mode is active, then exits the mode", () => {
      setupSelfArcher(pos(0, 0));
      const target = pos(2, 0);
      PiecesRepository.add(
        createPiece({
          id: 2,
          panelPosition: target,
          initialPosition: target,
          player: Player.OPPONENT,
          pieceType: PieceType.INFANTRY,
        }),
      );

      InteractionService.pieceChange(getPiece(1));
      InteractionService.toggleRangedAttackMode();
      expect(SelectionRepository.isRangedAttackMode()).toBe(true);

      InteractionService.panelChange(target);

      expect(SelectionRepository.isRangedAttackMode()).toBe(false);
      expect(samePos(getPiece(1).rangedAttackTargetPosition, target)).toBe(true);
      // The archer never moves when assigning a ranged attack.
      expect(samePos(getPiece(1).panelPosition, pos(0, 0))).toBe(true);
    });

    test("selecting a different piece exits ranged attack mode", () => {
      setupSelfArcher(pos(0, 0));
      setupSelfPiece(pos(0, 1), 2);

      InteractionService.pieceChange(getPiece(1));
      InteractionService.toggleRangedAttackMode();
      expect(SelectionRepository.isRangedAttackMode()).toBe(true);

      InteractionService.pieceChange(getPiece(2));
      expect(SelectionRepository.isRangedAttackMode()).toBe(false);
    });
  });
});
