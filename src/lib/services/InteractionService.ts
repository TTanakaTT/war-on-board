import { Panel } from "$lib/domain/entities/Panel";
import { PanelPosition } from "$lib/domain/entities/PanelPosition";
import { PanelState } from "$lib/domain/enums/PanelState";
import type { Piece } from "$lib/domain/entities/Piece";
import { PanelsService } from "$lib/services/PanelService";
import { PiecesRepository } from "$lib/data/repositories/PieceRepository";
import { PanelRepository } from "$lib/data/repositories/PanelRepository";
import { TurnRepository } from "$lib/data/repositories/TurnRepository";
import { SelectedPanelRepository } from "$lib/data/repositories/SelectedPanelRepository";
import { MovementRulesService } from "$lib/services/MovementRulesService";
import { DEFAULT_MAX_PIECES_PER_PANEL } from "$lib/domain/constants/GameConstants";
import { GameApi } from "$lib/api/GameApi";
import { MatchService } from "$lib/services/MatchService";

/**
 * InteractionService — handles user/AI interaction with the board.
 *
 * Responsible for:
 *  - pieceChange(): piece click → select / cancel
 *  - panelChange(): panel click → assign target / cancel move
 *  - stateChange(): recompute MOVABLE / IMMOVABLE / SELECTED highlights
 *
 * Delegates movement-rule queries to MovementRulesService.
 */
export class InteractionService {
  static clearSelection(): void {
    SelectedPanelRepository.set(undefined);
  }

  /**
   * Handle a panel background click.
   *
   * - SELECTED panel → cancel pending move (if allowed by cap).
   * - MOVABLE panel → assign as move target.
   * - Other → ignored (piece clicks drive selection, not panel background).
   */
  static panelChange(panelPosition: PanelPosition) {
    if (!this.isHumanInteractionAllowed()) return;

    const panelState = PanelsService.findPanelState(panelPosition);

    switch (panelState) {
      case PanelState.SELECTED: {
        const selectedPieceId = SelectedPanelRepository.getPieceId();
        const selectedPiece = PiecesRepository.getAll().find((p) => p.id === selectedPieceId);
        if (selectedPiece && selectedPiece.targetPosition) {
          const result = GameApi.cancelMove(selectedPiece.player, selectedPiece.id);
          if (!result.ok) return;

          const cleared = PanelsService.clearSelected();
          PanelRepository.setAll(cleared);
          this.clearSelection();
          return;
        }
        break;
      }
      case PanelState.MOVABLE: {
        const selectedPieceId = SelectedPanelRepository.getPieceId();
        if (selectedPieceId !== undefined) {
          const turn = TurnRepository.get();
          const result = GameApi.assignMove(turn.player, selectedPieceId, panelPosition);
          if (!result.ok) return;
        }
        break;
      }
      default:
        return;
    }
    this.stateChange(panelPosition);
  }

  /**
   * Handle a piece icon click.
   *
   * - Clicking a current-turn piece selects it and highlights movable panels.
   * - Move cancellation is handled by panelChange() when the selected source panel is clicked.
   */
  static pieceChange(piece: Piece) {
    if (!this.isHumanInteractionAllowed()) return;

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

  /**
   * Recompute panel highlight states after a selection/move action.
   *
   * State transitions applied to ALL panels:
   *   - Source panel        → SELECTED
   *   - Reachable & allowed → MOVABLE  (green-ish, clickable)
   *   - Reachable & blocked → left unchanged (not MOVABLE)
   *   - All others          → IMMOVABLE (dimmed, non-interactive)
   *
   * "Allowed" is determined by MovementRulesService.canMoveTo().
   */
  static stateChange(panelPosition: PanelPosition) {
    const originalPanel = PanelsService.find(panelPosition);
    const panelState = originalPanel?.panelState;

    switch (panelState) {
      case PanelState.SELECTED:
      case PanelState.MOVABLE: {
        PanelRepository.setAll(PanelsService.clearSelected());
        break;
      }
      case PanelState.OCCUPIED: {
        this.highlightMovableFromOccupied(panelPosition, originalPanel!);
        break;
      }
      default: {
        this.highlightMovableFromEmpty(panelPosition, originalPanel);
        break;
      }
    }
  }

  // ── Private helpers ──────────────────────────────────────────────

  /**
   * Highlight reachable panels when a piece on an OCCUPIED panel is selected.
   */
  private static highlightMovableFromOccupied(panelPosition: PanelPosition, originalPanel: Panel) {
    const selectedPieces = PiecesRepository.getPiecesByPosition(panelPosition);
    const selectedPieceId = SelectedPanelRepository.getPieceId();
    const selectedPiece = selectedPieces.find((p) => p.id === selectedPieceId) ?? selectedPieces[0];
    const referencePosition = selectedPiece?.initialPosition ?? panelPosition;

    // Mark source as SELECTED
    PanelRepository.update(
      new Panel({
        ...originalPanel,
        panelState: PanelState.SELECTED,
      }),
    );

    // Compute reachable panels (adjacent to initial position + initial position itself)
    const adjacentPanels = PanelsService.findAdjacentPanels(referencePosition);
    const initialPanel = PanelsService.find(referencePosition);
    const reachablePanels = initialPanel ? [initialPanel, ...adjacentPanels] : adjacentPanels;

    const turn = TurnRepository.get();
    const maxPieces =
      turn.maxPiecesPerPanel[String(selectedPiece.player)] ?? DEFAULT_MAX_PIECES_PER_PANEL;

    // Mark each reachable panel as MOVABLE (if movement rules allow)
    reachablePanels
      .filter((p: Panel) => !p.panelPosition.equals(panelPosition))
      .forEach((targetPanel: Panel) => {
        if (
          MovementRulesService.canMoveTo(
            targetPanel.panelPosition,
            selectedPiece.player,
            selectedPiece.id,
            maxPieces,
          )
        ) {
          PanelRepository.update(
            new Panel({
              ...targetPanel,
              panelState: PanelState.MOVABLE,
            }),
          );
        }
      });

    // Dim all non-reachable panels
    this.dimUnreachablePanels(
      panelPosition,
      reachablePanels.map((p) => p.panelPosition),
    );
  }

  /**
   * Highlight reachable panels when an empty / unoccupied panel is clicked.
   * (Used during board-setup-like interactions.)
   */
  private static highlightMovableFromEmpty(
    panelPosition: PanelPosition,
    originalPanel: Panel | undefined,
  ) {
    PanelRepository.update(
      new Panel({
        panelPosition: panelPosition,
        panelState: PanelState.SELECTED,
        player: originalPanel?.player,
        resource: originalPanel?.resource,
        castle: originalPanel?.castle,
      }),
    );

    const adjacentPanels = PanelsService.findAdjacentPanels(panelPosition);
    adjacentPanels
      .filter((p: Panel) => p.panelState === PanelState.UNOCCUPIED)
      .forEach((adjacentPanel: Panel) => {
        const hasPiece =
          PiecesRepository.getPiecesByPosition(adjacentPanel.panelPosition).length > 0;
        PanelRepository.update(
          new Panel({
            ...adjacentPanel,
            panelState: hasPiece ? PanelState.OCCUPIED : PanelState.MOVABLE,
          }),
        );
      });

    this.dimUnreachablePanels(
      panelPosition,
      adjacentPanels.map((p) => p.panelPosition),
    );
  }

  /**
   * Set all panels that are NOT in <reachablePositions> and NOT the source
   * to IMMOVABLE (dimmed, non-interactive).
   */
  private static dimUnreachablePanels(
    sourcePosition: PanelPosition,
    reachablePositions: PanelPosition[],
  ) {
    PanelRepository.getAll().forEach((p: Panel) => {
      if (
        !p.panelPosition.equals(sourcePosition) &&
        !reachablePositions.some((pos) => pos.equals(p.panelPosition)) &&
        p.panelState !== PanelState.IMMOVABLE &&
        p.panelState !== PanelState.MOVABLE
      ) {
        PanelRepository.update(
          new Panel({
            ...p,
            panelState: PanelState.IMMOVABLE,
          }),
        );
      }
    });
  }

  private static isHumanInteractionAllowed(): boolean {
    return (
      MatchService.getControllerForCurrentTurn() === "human" && !MatchService.isAutomationRunning()
    );
  }
}
