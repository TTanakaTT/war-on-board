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

const pos = (horizontalLayer: number, verticalLayer: number) =>
  new PanelPosition({ horizontalLayer, verticalLayer });

function setupSelfPiece(position: PanelPosition, id = 1): Piece {
  const piece = new Piece({
    id,
    panelPosition: position,
    initialPosition: position,
    player: Player.SELF,
    pieceType: PieceType.KNIGHT,
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

  describe("panelChange", () => {
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
});
