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
   * and either not at max capacity OR the panel has a same-type mergeable piece
   * (merge will consolidate after generation).
   */
  static findGenerationPanel(player: Player, pieceType?: PieceType): PanelPosition | null {
    const turn = TurnRepository.get();
    const maxPieces = turn.maxPiecesPerPanel[String(player)] ?? DEFAULT_MAX_PIECES_PER_PANEL;
    const homeBase = HomeBaseRepository.getByPlayer(player);
    const mode = turn.generationMode[String(player)] ?? "rear";

    const candidates = PanelRepository.getAll().filter((panel) => {
      if (panel.player !== player) return false;
      if (panel.resource < RESOURCE_THRESHOLD_FOR_GENERATION) return false;
      const piecesAtPanel = PiecesRepository.getPiecesByPosition(panel.panelPosition);
      if (piecesAtPanel.length < maxPieces) return true;
      // At capacity — allow if the new piece would merge with an existing one
      if (pieceType?.config.mergeable) {
        return piecesAtPanel.some((p) => p.player === player && p.pieceType === pieceType);
      }
      return false;
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
      return;
    }

    const generatePosition = this.findGenerationPanel(turn.player, pieceType);
    if (!generatePosition) {
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
        resource: existingPanel?.resource ?? 0,
        castle: existingPanel?.castle ?? 0,
      }),
    );
  }
}
