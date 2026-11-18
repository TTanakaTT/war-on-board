import { Panel } from "#lib/domain/entities/Panel.ts";
import { Piece } from "#lib/domain/entities/Piece.ts";
import { PanelState } from "#lib/domain/enums/PanelState.ts";
import { Player } from "#lib/domain/enums/Player.ts";
import type { PanelPosition } from "#lib/domain/entities/PanelPosition.ts";
import type { PieceType } from "#lib/domain/enums/PieceType.ts";
import { PiecesRepository } from "#lib/data/repositories/PieceRepository.ts";
import { PanelRepository } from "#lib/data/repositories/PanelRepository.ts";
import { TurnRepository } from "#lib/data/repositories/TurnRepository.ts";
import { HomeBaseRepository } from "#lib/data/repositories/HomeBaseRepository.ts";
import { PieceService } from "#lib/services/PieceService.ts";
import { MovementRulesService, type EndOfTurnPlan } from "#lib/services/MovementRulesService.ts";
import {
  RESOURCE_THRESHOLD_FOR_GENERATION,
  DEFAULT_MAX_PIECES_PER_PANEL,
} from "#lib/domain/constants/GameConstants.ts";
import { PieceType as PieceTypeClass } from "#lib/domain/enums/PieceType.ts";

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
   * Mode "front": lower horizontal distance to the opponent home base first.
   *
   * Conditions: owned by player, resource >= RESOURCE_THRESHOLD_FOR_GENERATION,
   * and enough capacity for the new piece (see `hasCapacityForNewPiece`), which takes
   * reserved moves into and out of the panel into account.
   *
   * The first candidate in priority order that meets these conditions is returned, so a full
   * first choice falls through to the next candidate. When
   * `pieceType` is omitted, the new piece is treated as non-mergeable.
   *
   * @returns The chosen panel position, or `null` when no panel qualifies.
   */
  static findGenerationPanel(player: Player, pieceType?: PieceType): PanelPosition | null {
    const turn = TurnRepository.get();
    const maxPieces = turn.maxPiecesPerPanel[String(player)] ?? DEFAULT_MAX_PIECES_PER_PANEL;
    const homeBase = HomeBaseRepository.getByPlayer(player);
    const opponent = player === Player.SELF ? Player.OPPONENT : Player.SELF;
    const opponentHomeBase = HomeBaseRepository.getByPlayer(opponent);
    const mode = turn.generationMode[String(player)] ?? "rear";

    const candidates = PanelRepository.getAll().filter(
      (panel) => panel.player === player && panel.resource >= RESOURCE_THRESHOLD_FOR_GENERATION,
    );

    candidates.sort((a, b) => {
      // Home base priority only in rear mode
      if (mode === "rear") {
        const aIsHome = homeBase?.panelPosition.equals(a.panelPosition) ? 0 : 1;
        const bIsHome = homeBase?.panelPosition.equals(b.panelPosition) ? 0 : 1;
        if (aIsHome !== bIsHome) return aIsHome - bIsHome;
      }

      if (mode === "rear") {
        const aAbsHL = Math.abs(a.panelPosition.horizontalLayer);
        const bAbsHL = Math.abs(b.panelPosition.horizontalLayer);
        if (aAbsHL !== bAbsHL) return bAbsHL - aAbsHL;
      } else if (opponentHomeBase) {
        const aHorizontalDistanceToOpponent = Math.abs(
          a.panelPosition.horizontalLayer - opponentHomeBase.panelPosition.horizontalLayer,
        );
        const bHorizontalDistanceToOpponent = Math.abs(
          b.panelPosition.horizontalLayer - opponentHomeBase.panelPosition.horizontalLayer,
        );
        if (aHorizontalDistanceToOpponent !== bHorizontalDistanceToOpponent) {
          return aHorizontalDistanceToOpponent - bHorizontalDistanceToOpponent;
        }
      }

      return a.panelPosition.verticalLayer - b.panelPosition.verticalLayer;
    });

    // Capacity is checked in priority order, planning the current board at most once.
    let plan: EndOfTurnPlan | undefined;
    const currentPlan = () => (plan ??= MovementRulesService.planEndOfTurn(player, maxPieces));
    const chosen = candidates.find((panel) =>
      this.hasCapacityForNewPiece(panel.panelPosition, player, maxPieces, currentPlan, pieceType),
    );
    return chosen?.panelPosition ?? null;
  }

  /**
   * Capacity rule for spawning a piece of `pieceType` on `position` (limit: `maxPieces`).
   *
   * - Mergeable type with a same-type piece of `player` already on the panel (and not in
   *   transit): always fits, because the new piece merges into it right after generation.
   * - Otherwise the player's pieces currently on the panel + 1 must stay within the limit,
   *   and the end-of-turn plan with the new piece staying on the panel must keep the panel
   *   within the limit and cancel no other piece's order that was being carried out
   *   (MovementRulesService.canPlaceNewPiece). Without `pieceType`, the new piece counts as
   *   a non-mergeable piece.
   */
  private static hasCapacityForNewPiece(
    position: PanelPosition,
    player: Player,
    maxPieces: number,
    currentPlan: () => EndOfTurnPlan,
    pieceType?: PieceType,
  ): boolean {
    const ownPiecesAtPanel = PiecesRepository.getPiecesByPosition(position).filter(
      (piece) => piece.player === player,
    );
    if (
      pieceType?.config.mergeable &&
      ownPiecesAtPanel.some((piece) => piece.pieceType === pieceType && !piece.isInTransit)
    ) {
      return true;
    }
    if (ownPiecesAtPanel.length + 1 > maxPieces) return false;

    const newPiece = new Piece({
      id: PieceService.generateNextId(),
      panelPosition: position,
      player,
      // Any non-mergeable type stands in for a piece of unknown type.
      pieceType: pieceType ?? PieceTypeClass.ROOK,
    });
    return MovementRulesService.canPlaceNewPiece(newPiece, maxPieces, currentPlan());
  }

  /**
   * Generate a new piece of the given type for the current player.
   * Consumes resources and places the piece on the best available panel.
   */
  static generate(
    pieceType: PieceType = PieceTypeClass.INFANTRY,
    generationPosition?: PanelPosition,
  ): PanelPosition | null {
    const turn = TurnRepository.get();
    const cost = pieceType.config.cost;
    const currentResources = turn.resources[String(turn.player)] ?? 0;

    if (currentResources < cost) {
      return null;
    }

    const generatePosition = generationPosition ?? this.findGenerationPanel(turn.player, pieceType);
    if (!generatePosition) {
      return null;
    }

    const existingPanel = PanelRepository.find(generatePosition);
    if (!existingPanel) {
      return null;
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
        resource: existingPanel?.resource ?? 0,
        castle: existingPanel?.castle ?? 0,
      }),
    );

    return generatePosition;
  }
}
