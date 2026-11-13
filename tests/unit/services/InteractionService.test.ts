import { beforeEach, describe, expect, test } from "vitest";
import { GameApi } from "$lib/api/GameApi";
import { PanelRepository } from "$lib/data/repositories/PanelRepository";
import { PiecesRepository } from "$lib/data/repositories/PieceRepository";
import { SelectedPanelRepository } from "$lib/data/repositories/SelectedPanelRepository";
import { PanelPosition } from "$lib/domain/entities/PanelPosition";
import { Piece } from "$lib/domain/entities/Piece";
import { PanelState } from "$lib/domain/enums/PanelState";
import { PieceType } from "$lib/domain/enums/PieceType";
import { Player } from "$lib/domain/enums/Player";
import { InteractionService } from "$lib/services/InteractionService";
import { PanelsService } from "$lib/services/PanelService";
import { RangedAttackModeRepository } from "$lib/data/repositories/RangedAttackModeRepository";

const pos = (horizontalLayer: number, verticalLayer: number) =>
  new PanelPosition({ horizontalLayer, verticalLayer });

function setupSelfPiece(position: PanelPosition, id = 1): Piece {
  const piece = new Piece({
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
  const piece = new Piece({
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
    SelectedPanelRepository.set(undefined);
  });

  describe("pieceChange", () => {
    test("reselects a piece with a pending move instead of cancelling immediately", () => {
      setupSelfPiece(pos(0, 0));
      const target = pos(0, 1);

      GameApi.assignMove(Player.SELF, 1, target);
      InteractionService.pieceChange(getPiece(1));

      expect(getPiece(1).targetPosition?.equals(target)).toBe(true);
      expect(SelectedPanelRepository.getPieceId()).toBe(1);
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

      expect(SelectedPanelRepository.getPieceId()).toBeUndefined();
      expect(hasHighlight()).toBe(false);
    });

    test("selecting another piece switches the selection", () => {
      setupSelfPiece(pos(0, 0));
      setupSelfPiece(pos(0, 1), 2);

      InteractionService.pieceChange(getPiece(1));
      InteractionService.pieceChange(getPiece(2));

      expect(SelectedPanelRepository.getPieceId()).toBe(2);
      expect(PanelRepository.find(pos(0, 1))?.panelState).toBe(PanelState.SELECTED);
      expect(PanelRepository.find(pos(0, 0))?.panelState).not.toBe(PanelState.SELECTED);
    });

    test("selecting another piece on the same panel switches the selection", () => {
      setupSelfPiece(pos(0, 0));
      setupSelfPiece(pos(0, 0), 2);

      InteractionService.pieceChange(getPiece(1));
      InteractionService.pieceChange(getPiece(2));

      expect(SelectedPanelRepository.getPieceId()).toBe(2);
      expect(PanelRepository.find(pos(0, 0))?.panelState).toBe(PanelState.SELECTED);
    });

    test("clicking the SELECTED panel background clears the selected piece id", () => {
      setupSelfPiece(pos(0, 0));

      InteractionService.pieceChange(getPiece(1));
      InteractionService.panelChange(pos(0, 0));

      expect(SelectedPanelRepository.getPieceId()).toBeUndefined();
      expect(hasHighlight()).toBe(false);
    });

    test("assigning a move clears the selected piece id", () => {
      setupSelfPiece(pos(0, 0));

      InteractionService.pieceChange(getPiece(1));
      InteractionService.panelChange(pos(0, 1));

      expect(getPiece(1).targetPosition?.equals(pos(0, 1))).toBe(true);
      expect(SelectedPanelRepository.getPieceId()).toBeUndefined();
    });
  });

  describe("panelChange", () => {
    test("OCCUPIED background click selects the first unreserved own piece", () => {
      setupSelfPiece(pos(0, 0));
      setupSelfPiece(pos(0, 0), 2);
      GameApi.assignMove(Player.SELF, 1, pos(0, 1));
      PanelsService.refreshPanelStates();

      InteractionService.panelChange(pos(0, 0));

      expect(SelectedPanelRepository.getPieceId()).toBe(2);
    });

    test("OCCUPIED background click selects the first reserved piece when all are reserved", () => {
      setupSelfPiece(pos(0, 0));
      setupSelfPiece(pos(0, 0), 2);
      GameApi.assignMove(Player.SELF, 1, pos(0, 1));
      GameApi.assignMove(Player.SELF, 2, pos(1, 0));
      PanelsService.refreshPanelStates();

      InteractionService.panelChange(pos(0, 0));

      expect(SelectedPanelRepository.getPieceId()).toBe(1);
    });

    test("OCCUPIED background click does nothing for opponent-only panels", () => {
      PiecesRepository.add(
        new Piece({
          id: 1,
          panelPosition: pos(0, 0),
          initialPosition: pos(0, 0),
          player: Player.OPPONENT,
          pieceType: PieceType.INFANTRY,
        }),
      );
      PanelsService.refreshPanelStates();

      InteractionService.panelChange(pos(0, 0));

      expect(SelectedPanelRepository.getPieceId()).toBeUndefined();
    });

    test("cancels a pending move when the selected source panel is clicked", () => {
      setupSelfPiece(pos(0, 0));
      const source = pos(0, 0);
      const target = pos(0, 1);

      GameApi.assignMove(Player.SELF, 1, target);
      InteractionService.pieceChange(getPiece(1));
      InteractionService.panelChange(source);

      expect(getPiece(1).targetPosition).toBeUndefined();
      expect(SelectedPanelRepository.getPieceId()).toBeUndefined();
      expect(PanelRepository.find(source)?.panelState).toBe(PanelState.OCCUPIED);
    });

    test("reassigns a pending move when another movable panel is clicked after reselection", () => {
      setupSelfPiece(pos(0, 0));
      const firstTarget = pos(0, 1);
      const nextTarget = pos(1, 0);

      GameApi.assignMove(Player.SELF, 1, firstTarget);
      InteractionService.pieceChange(getPiece(1));
      InteractionService.panelChange(nextTarget);

      expect(getPiece(1).targetPosition?.equals(nextTarget)).toBe(true);
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

    test("leaves a distant panel unchanged when canMoveTo disallows it (piece cannot attack at all)", () => {
      setupSelfPiece(pos(-3, 0));
      const noble = getPiece(1);
      PiecesRepository.update(new Piece({ ...noble, pieceType: PieceType.NOBLE }));

      const distantEnemyPosition = pos(0, 0);
      PiecesRepository.add(
        new Piece({
          id: 2,
          panelPosition: distantEnemyPosition,
          initialPosition: distantEnemyPosition,
          player: Player.OPPONENT,
          pieceType: PieceType.INFANTRY,
        }),
      );
      PanelsService.refreshPanelStates();

      InteractionService.pieceChange(getPiece(1));

      const panelState = PanelRepository.find(distantEnemyPosition)?.panelState;
      expect(panelState).not.toBe(PanelState.MOVABLE);
      expect(panelState).not.toBe(PanelState.IMMOVABLE);
    });
  });

  describe("ranged attack mode", () => {
    test("toggleRangedAttackMode does nothing when no piece is selected", () => {
      InteractionService.toggleRangedAttackMode();
      expect(RangedAttackModeRepository.isActive()).toBe(false);
    });

    test("panelChange fires assignRangedAttack when attack mode is active, then exits the mode", () => {
      setupSelfArcher(pos(0, 0));
      const target = pos(2, 0);
      PiecesRepository.add(
        new Piece({
          id: 2,
          panelPosition: target,
          initialPosition: target,
          player: Player.OPPONENT,
          pieceType: PieceType.INFANTRY,
        }),
      );

      InteractionService.pieceChange(getPiece(1));
      InteractionService.toggleRangedAttackMode();
      expect(RangedAttackModeRepository.isActive()).toBe(true);

      InteractionService.panelChange(target);

      expect(RangedAttackModeRepository.isActive()).toBe(false);
      expect(getPiece(1).rangedAttackTargetPosition?.equals(target)).toBe(true);
      // The archer never moves when assigning a ranged attack.
      expect(getPiece(1).panelPosition.equals(pos(0, 0))).toBe(true);
    });

    test("selecting a different piece exits ranged attack mode", () => {
      setupSelfArcher(pos(0, 0));
      setupSelfPiece(pos(0, 1), 2);

      InteractionService.pieceChange(getPiece(1));
      InteractionService.toggleRangedAttackMode();
      expect(RangedAttackModeRepository.isActive()).toBe(true);

      InteractionService.pieceChange(getPiece(2));
      expect(RangedAttackModeRepository.isActive()).toBe(false);
    });
  });
});
