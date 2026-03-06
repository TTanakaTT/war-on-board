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
import { HomeBaseRepository } from "$lib/data/repositories/HomeBaseRepository";
import { SelectedPanelRepository } from "$lib/data/repositories/SelectedPanelRepository";
import { PieceService } from "$lib/services/PieceService";

const RESOURCE_THRESHOLD_FOR_GENERATION = 5;

export class GameRulesService {
  /**
   * Check if a panel has enemy presence (enemy pieces or castle) for a given player.
   */
  static hasEnemyPresence(position: PanelPosition, player: Player): boolean {
    const enemyPieces = PiecesRepository.getPiecesByPosition(position).filter(
      (p) => p.player !== player && p.player !== Player.UNKNOWN,
    );
    if (enemyPieces.length > 0) return true;
    const panel = PanelRepository.find(position);
    return (
      !!panel && panel.player !== player && panel.player !== Player.UNKNOWN && panel.castle > 0
    );
  }

  /**
   * Compute projected friendly piece count at a position after all planned moves resolve.
   * Pieces targeting enemy panels (with enemy pieces or castle) are conservatively
   * counted at their current position since combat may prevent them from moving.
   */
  static projectedFriendlyCount(
    position: PanelPosition,
    player: Player,
    excludePieceId?: number,
  ): number {
    const allFriendly = PiecesRepository.getPiecesByPlayer(player);
    let count = 0;
    for (const piece of allFriendly) {
      if (piece.id === excludePieceId) continue;
      let destination: PanelPosition;
      if (piece.targetPosition) {
        const isAttack = this.hasEnemyPresence(piece.targetPosition, player);
        destination = isAttack ? piece.panelPosition : piece.targetPosition;
      } else {
        destination = piece.panelPosition;
      }
      if (destination.equals(position)) count++;
    }
    return count;
  }

  /**
   * Find the best panel for unit generation.
   * "rear" mode: home base > higher |horizontalLayer| (closer to home).
   * "front" mode: home base > lower |horizontalLayer| (closer to enemy).
   * Conditions: owned by player, resource >= 5, not at max capacity.
   */
  static findGenerationPanel(player: Player): PanelPosition | null {
    const turn = TurnRepository.get();
    const maxPieces = turn.maxPiecesPerPanel[String(player)] ?? 2;
    const homeBase = HomeBaseRepository.getByPlayer(player);
    const mode = turn.generationMode[String(player)] ?? "rear";

    const candidates = PanelRepository.getAll().filter((panel) => {
      if (panel.player !== player) return false;
      if (panel.resource < RESOURCE_THRESHOLD_FOR_GENERATION) return false;
      if (PiecesRepository.getPiecesByPosition(panel.panelPosition).length >= maxPieces)
        return false;
      return true;
    });

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => {
      // Home base priority only in rear mode
      if (mode === "rear") {
        const aIsHome = homeBase?.panelPosition.equals(a.panelPosition) ? 0 : 1;
        const bIsHome = homeBase?.panelPosition.equals(b.panelPosition) ? 0 : 1;
        if (aIsHome !== bIsHome) return aIsHome - bIsHome;
      }

      const aAbsHL = Math.abs(a.panelPosition.horizontalLayer);
      const bAbsHL = Math.abs(b.panelPosition.horizontalLayer);
      if (aAbsHL !== bAbsHL) return mode === "rear" ? bAbsHL - aAbsHL : aAbsHL - bAbsHL;

      return a.panelPosition.verticalLayer - b.panelPosition.verticalLayer;
    });

    return candidates[0].panelPosition;
  }

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

    const generatePosition = this.findGenerationPanel(turn.player);
    if (!generatePosition) {
      console.warn(`No available panel for unit generation.`);
      return;
    }

    const existingPanel = PanelRepository.find(generatePosition);

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
        resource: existingPanel?.resource ?? 5,
        castle: existingPanel?.castle ?? 0,
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
          // Prevent cancel if it would cause cap violation at the piece's current panel
          const turn = TurnRepository.get();
          const maxPieces = turn.maxPiecesPerPanel[String(selectedPiece.player)] ?? 2;
          const projectedAtCurrent = this.projectedFriendlyCount(
            selectedPiece.panelPosition,
            selectedPiece.player,
            selectedPiece.id,
          );
          if (projectedAtCurrent + 1 > maxPieces) {
            return;
          }

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

    const currentSelectedPieceId = SelectedPanelRepository.getPieceId();

    // Re-clicking the same piece with a pending move: cancel the move
    if (currentSelectedPieceId === piece.id && piece.targetPosition) {
      const maxPieces = turn.maxPiecesPerPanel[String(piece.player)] ?? 2;
      const projectedAtCurrent = this.projectedFriendlyCount(
        piece.panelPosition,
        piece.player,
        piece.id,
      );
      if (projectedAtCurrent + 1 <= maxPieces) {
        const updatedPiece = new Piece({
          ...piece,
          targetPosition: undefined,
        });
        PiecesRepository.update(updatedPiece);
      }
      const cleared = PanelsService.clearSelected();
      PanelRepository.setAll(cleared);
      SelectedPanelRepository.set(undefined);
      return;
    }

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
            // Enemy panels are always movable (attack target, cap irrelevant)
            const isAttack = this.hasEnemyPresence(targetPanel.panelPosition, selectedPiece.player);
            if (!isAttack) {
              const projectedCount = this.projectedFriendlyCount(
                targetPanel.panelPosition,
                selectedPiece.player,
                selectedPiece.id,
              );
              if (projectedCount + 1 > maxPieces) return;
            }

            PanelRepository.update(
              new Panel({
                panelPosition: targetPanel.panelPosition,
                panelState: PanelState.MOVABLE,
                player: targetPanel.player,
                resource: targetPanel.resource,
                castle: targetPanel.castle,
              }),
            );
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
