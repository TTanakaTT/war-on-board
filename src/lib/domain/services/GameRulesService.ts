import { Panel } from "$lib/domain/entities/Panel";
import { PanelPosition } from "$lib/domain/entities/PanelPosition";
import { PanelState } from "$lib/domain/enums/PanelState";
import { Player } from "$lib/domain/enums/Player";
import { Piece } from "$lib/domain/entities/Piece";
import { PieceType } from "$lib/domain/enums/PieceType";
import { PanelsService } from "$lib/data/services/PanelService";
import { PiecesRepository } from "$lib/data/repositories/PieceRepository";
import { PanelRepository } from "$lib/data/repositories/PanelRepository";
import { TurnRepository } from "$lib/data/repositories/TurnRepository";
import { LayerRepository } from "$lib/data/repositories/LayerRepository";
import { SelectedPanelRepository } from "$lib/data/repositories/SelectedPanelRepository";
import { PieceService } from "$lib/data/services/PieceService";
import { piecesState } from "$lib/presentation/state/PiecesState.svelte";

export class GameRulesService {
  static generate(pieceType: PieceType = PieceType.KNIGHT) {
    const turn = TurnRepository.get();
    const layer = LayerRepository.get();
    const generatePosition = new PanelPosition({
      horizontalLayer: turn.player === Player.SELF ? -(layer - 1) : layer - 1,
      verticalLayer: 0,
    });
    if (PiecesRepository.getPiecesByPosition(generatePosition).length > 0) {
      console.warn(
        `Cannot generate piece at ${generatePosition.horizontalLayer}, ${generatePosition.verticalLayer} because it is already occupied.`,
      );
      return;
    }
    const piece = new Piece({ panelPosition: generatePosition, player: turn.player, pieceType });
    piecesState.add(piece);
    PanelRepository.update(
      new Panel({
        panelPosition: generatePosition,
        panelState: PanelState.OCCUPIED,
        player: turn.player,
        resource: 5,
        castle: 5,
      }),
    );
  }

  static panelChange(panelPosition: PanelPosition) {
    const turn = TurnRepository.get();
    const _selectedPiece = PiecesRepository.getPiecesByPosition(panelPosition)[0];
    const panelState = PanelsService.findPanelState(panelPosition);
    if (
      panelState != PanelState.MOVABLE &&
      _selectedPiece &&
      _selectedPiece.player !== turn.player
    ) {
      return;
    }
    switch (panelState) {
      case PanelState.SELECTED: {
        break;
      }
      case PanelState.MOVABLE: {
        const selectedPanel = SelectedPanelRepository.get();
        const selectedPiece = PiecesRepository.getPiecesByPosition(selectedPanel!.panelPosition)[0];
        const existingPieces = PiecesRepository.getPiecesByPosition(panelPosition);
        const existingEnemyPieces = existingPieces.filter((p) => p.player !== selectedPiece.player);
        if (existingEnemyPieces.length > 0) {
          piecesState.remove(selectedPiece);
          existingEnemyPieces.forEach((p) => piecesState.remove(p));
          PanelRepository.update(
            new Panel({
              panelPosition: panelPosition,
              panelState: PanelState.OCCUPIED,
              player: selectedPiece.player,
              resource: selectedPanel!.resource,
              castle: selectedPanel!.castle,
            }),
          );
        } else {
          PieceService.move(panelPosition, selectedPiece);
        }
        break;
      }
      default: {
        SelectedPanelRepository.set(
          new Panel({
            panelPosition: panelPosition,
            panelState: panelState ? panelState : PanelState.SELECTED,
            player: turn.player,
            resource: 0,
            castle: 0,
          }),
        );
      }
    }
    this.stateChange(panelPosition);
  }

  static stateChange(panelPosition: PanelPosition) {
    const originalPanel = PanelsService.find(panelPosition);
    const panelState = originalPanel?.panelState;
    let panel: Panel;

    switch (panelState) {
      case PanelState.SELECTED:
      case PanelState.MOVABLE: {
        const cleared = PanelsService.clearSelected();
        PanelRepository.setAll(cleared);
        break;
      }
      case PanelState.OCCUPIED: {
        const selectedPieces = PiecesRepository.getPiecesByPosition(panelPosition);
        const selectedPiece = selectedPieces[0];
        const referencePosition = selectedPiece?.initialPosition ?? panelPosition;

        panel = new Panel({
          panelPosition: panelPosition,
          panelState: PanelState.SELECTED,
          player: originalPanel?.player,
          resource: originalPanel?.resource,
          castle: originalPanel?.castle,
        });
        PanelRepository.update(panel);

        const adjacentPanels = PanelsService.findAdjacentPanels(referencePosition);
        const initialPanel = PanelsService.find(referencePosition);
        const targetPanels = initialPanel ? [initialPanel, ...adjacentPanels] : adjacentPanels;

        targetPanels
          .filter((p) => !p.panelPosition.equals(panelPosition))
          .forEach((targetPanel) => {
            const hasPiece =
              PiecesRepository.getPiecesByPosition(targetPanel.panelPosition).length > 0;
            if (!hasPiece) {
              PanelRepository.update(
                new Panel({
                  panelPosition: targetPanel.panelPosition,
                  panelState: PanelState.MOVABLE,
                  player: targetPanel.player,
                  resource: targetPanel.resource,
                  castle: targetPanel.castle,
                }),
              );
            }
          });
        const allPanels = PanelRepository.getAll();
        const targetPositions = targetPanels.map((p) => p.panelPosition);
        allPanels.forEach((p) => {
          if (
            !p.panelPosition.equals(panelPosition) &&
            !targetPositions.some((pos) => pos.equals(p.panelPosition)) &&
            p.panelState !== PanelState.IMMOVABLE &&
            p.panelState !== PanelState.MOVABLE
          ) {
            PanelRepository.update(
              new Panel({
                panelPosition: p.panelPosition,
                panelState: PanelState.IMMOVABLE,
                player: p.player,
                resource: p.resource,
                castle: p.castle,
              }),
            );
          }
        });
        break;
      }
      default: {
        panel = new Panel({
          panelPosition: panelPosition,
          panelState: PanelState.SELECTED,
          player: originalPanel?.player,
          resource: originalPanel?.resource,
          castle: originalPanel?.castle,
        });
        PanelRepository.update(panel);

        const adjacentPanels = PanelsService.findAdjacentPanels(panelPosition);

        adjacentPanels
          .filter((p) => p.panelState === PanelState.UNOCCUPIED)
          .forEach((adjacentPanel) => {
            const hasPiece =
              PiecesRepository.getPiecesByPosition(adjacentPanel.panelPosition).length > 0;
            PanelRepository.update(
              new Panel({
                panelPosition: adjacentPanel.panelPosition,
                panelState: hasPiece ? PanelState.OCCUPIED : PanelState.MOVABLE,
                player: adjacentPanel.player,
                resource: adjacentPanel.resource,
                castle: adjacentPanel.castle,
              }),
            );
          });
        // 隣接パネル以外をIMMOVABLEにする
        const allPanels = PanelRepository.getAll();
        const adjacentPositions = adjacentPanels.map((p) => p.panelPosition);
        allPanels.forEach((p) => {
          if (
            !p.panelPosition.equals(panelPosition) &&
            !adjacentPositions.some((pos) => pos.equals(p.panelPosition)) &&
            p.panelState !== PanelState.IMMOVABLE &&
            p.panelState !== PanelState.MOVABLE
          ) {
            PanelRepository.update(
              new Panel({
                panelPosition: p.panelPosition,
                panelState: PanelState.IMMOVABLE,
                player: p.player,
                resource: p.resource,
                castle: p.castle,
              }),
            );
          }
        });
        break;
      }
    }
  }
}
