import { Panel } from "$lib/domain/entities/Panel";
import { PanelPosition } from "$lib/domain/entities/PanelPosition";
import { PanelState } from "$lib/domain/enums/PanelState";
import { Player } from "$lib/domain/enums/Player";
import { Piece } from "$lib/domain/entities/Piece";
import { PieceType } from "$lib/domain/enums/PieceType";
import { PanelsService } from "$lib/services/PanelService";
import { PiecesRepository } from "$lib/data/repositories/PieceRepository";
import { PanelRepository } from "$lib/data/repositories/PanelRepository";
import { TurnRepository } from "$lib/data/repositories/TurnRepository";
import { LayerRepository } from "$lib/data/repositories/LayerRepository";
import { SelectedPanelRepository } from "$lib/data/repositories/SelectedPanelRepository";
import { PieceService } from "$lib/services/PieceService";

export class GameRulesService {
  static generate(pieceType: PieceType = PieceType.KNIGHT) {
    const turn = TurnRepository.get();
    const cost = pieceType.config.cost;
    const currentResources = turn.resources[String(turn.player)] ?? 0;

    if (currentResources < cost) {
      console.warn(
        `Not enough resources to generate ${pieceType}. Cost: ${cost}, Current: ${currentResources}`,
      );
      return;
    }

    const layer = LayerRepository.get();
    const generatePosition = new PanelPosition({
      horizontalLayer: turn.player === Player.SELF ? -(layer - 1) : layer - 1,
      verticalLayer: 0,
    });
    const maxPieces = turn.maxPiecesPerPanel[String(turn.player)] ?? 2;
    if (PiecesRepository.getPiecesByPosition(generatePosition).length >= maxPieces) {
      console.warn(
        `Cannot generate piece at ${generatePosition.horizontalLayer}, ${generatePosition.verticalLayer} because it has reached the maximum number of pieces.`,
      );
      return;
    }

    // Consume resources
    const newResources = { ...turn.resources };
    newResources[String(turn.player)] = currentResources - cost;
    TurnRepository.set({ ...turn, resources: newResources });

    const id = PieceService.generateNextId();
    const piece = new Piece({
      id,
      panelPosition: generatePosition,
      player: turn.player,
      pieceType,
    });
    PiecesRepository.add(piece);
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
    const panelState = PanelsService.findPanelState(panelPosition);

    switch (panelState) {
      case PanelState.SELECTED: {
        const selectedPieceId = SelectedPanelRepository.getPieceId();
        const selectedPiece = PiecesRepository.getAll().find((p) => p.id === selectedPieceId);
        if (selectedPiece && selectedPiece.targetPosition) {
          const updatedPiece = new Piece({
            id: selectedPiece.id,
            panelPosition: selectedPiece.panelPosition,
            initialPosition: selectedPiece.initialPosition,
            targetPosition: undefined,
            player: selectedPiece.player,
            pieceType: selectedPiece.pieceType,
            hp: selectedPiece.hp,
          });
          PiecesRepository.update(updatedPiece);
        }
        break;
      }
      case PanelState.MOVABLE: {
        const selectedPieceId = SelectedPanelRepository.getPieceId();
        const selectedPiece = PiecesRepository.getAll().find((p) => p.id === selectedPieceId);

        if (selectedPiece) {
          const updatedPiece = new Piece({
            id: selectedPiece.id,
            panelPosition: selectedPiece.panelPosition,
            initialPosition: selectedPiece.initialPosition,
            targetPosition: panelPosition,
            player: selectedPiece.player,
            pieceType: selectedPiece.pieceType,
            hp: selectedPiece.hp,
          });
          PiecesRepository.update(updatedPiece);
        }
        break;
      }
      default: {
        // Do nothing for panel background clicks when not in MOVABLE/SELECTED state
        // This satisfies "駒のクリックのみで移動を開始してください"
        return;
      }
    }
    this.stateChange(panelPosition);
  }

  static pieceChange(piece: Piece) {
    const turn = TurnRepository.get();
    if (piece.player !== turn.player) return;

    SelectedPanelRepository.set(
      new Panel({
        panelPosition: piece.panelPosition,
        panelState: PanelState.SELECTED,
        player: piece.player,
        resource: 0,
        castle: 0,
      }),
      piece.id,
    );
    this.stateChange(piece.panelPosition);
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
        const selectedPieceId = SelectedPanelRepository.getPieceId();
        const selectedPiece =
          selectedPieces.find((p) => p.id === selectedPieceId) ?? selectedPieces[0];
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

        const turn = TurnRepository.get();
        const maxPieces = turn.maxPiecesPerPanel[String(selectedPiece.player)] ?? 2;

        targetPanels
          .filter((p: Panel) => !p.panelPosition.equals(panelPosition))
          .forEach((targetPanel: Panel) => {
            const pieces = PiecesRepository.getPiecesByPosition(targetPanel.panelPosition);
            const friendlyPieces = pieces.filter((p) => p.player === selectedPiece.player);

            if (friendlyPieces.length < maxPieces) {
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
        const targetPositions = targetPanels.map((p: Panel) => p.panelPosition);
        allPanels.forEach((p: Panel) => {
          if (
            !p.panelPosition.equals(panelPosition) &&
            !targetPositions.some((pos: PanelPosition) => pos.equals(p.panelPosition)) &&
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
          .filter((p: Panel) => p.panelState === PanelState.UNOCCUPIED)
          .forEach((adjacentPanel: Panel) => {
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
        // Set all non-adjacent panels to IMMOVABLE
        const allPanels = PanelRepository.getAll();
        const adjacentPositions = adjacentPanels.map((p: Panel) => p.panelPosition);
        allPanels.forEach((p: Panel) => {
          if (
            !p.panelPosition.equals(panelPosition) &&
            !adjacentPositions.some((pos: PanelPosition) => pos.equals(p.panelPosition)) &&
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
