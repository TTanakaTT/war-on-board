import { Panel } from "$lib/domain/entities/Panel";
import { Piece } from "$lib/domain/entities/Piece";
import { PanelState } from "$lib/domain/enums/PanelState";
import { Player } from "$lib/domain/enums/Player";
import type { PanelPosition } from "$lib/domain/entities/PanelPosition";
import type { PieceType } from "$lib/domain/enums/PieceType";
import { PiecesRepository } from "$lib/data/repositories/PieceRepository";
import { PanelRepository } from "$lib/data/repositories/PanelRepository";
import { TurnRepository } from "$lib/data/repositories/TurnRepository";
import { HomeBaseRepository } from "$lib/data/repositories/HomeBaseRepository";
import { PieceService } from "$lib/services/PieceService";
import {
  RESOURCE_THRESHOLD_FOR_GENERATION,
  DEFAULT_MAX_PIECES_PER_PANEL,
} from "$lib/domain/constants/GameConstants";
import { PieceType as PieceTypeClass } from "$lib/domain/enums/PieceType";

/**
 * GenerationService — unit generation logic.
 *
 * Finds the best panel for spawning and creates pieces.
 */
export class GenerationService {
  /**
   * Find the best panel for unit generation.
   *
   * Mode "rear": home base first → higher |horizontalLayer| (closer to home).
   * Mode "front": lower |horizontalLayer| first (closer to enemy).
   *
   * Conditions: owned by player, resource >= RESOURCE_THRESHOLD_FOR_GENERATION,
   * not at max capacity.
   */
  static findGenerationPanel(player: Player): PanelPosition | null {
    const turn = TurnRepository.get();
    const maxPieces = turn.maxPiecesPerPanel[String(player)] ?? DEFAULT_MAX_PIECES_PER_PANEL;
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

  /**
   * Generate a new piece of the given type for the current player.
   * Consumes resources and places the piece on the best available panel.
   */
  static generate(pieceType: PieceType = PieceTypeClass.KNIGHT) {
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
}
