import { GameApiClient } from "#lib/api/GameApiClient.ts";
import {
  PanelState,
  samePos,
  type Panel,
  type PanelPosition,
  type Piece,
} from "#lib/domain/model.ts";
import {
  PanelRepository,
  PiecesRepository,
  SelectionRepository,
  TurnRepository,
} from "#lib/store.svelte.ts";
import { MatchService } from "#lib/services/MatchService.ts";
import { MovementRulesService } from "#lib/services/MovementRulesService.ts";
import { PanelsService } from "#lib/services/PanelService.ts";

/** Human board clicks: selection, orders and panel highlights. */
export class InteractionService {
  static clearSelection(): void {
    SelectionRepository.setPieceId(undefined);
  }

  static toggleRangedAttackMode(): void {
    if (SelectionRepository.getPieceId() === undefined) return;
    SelectionRepository.setRangedAttackMode(!SelectionRepository.isRangedAttackMode());
  }

  /**
   * Ranged mode: fire at the panel. SELECTED: cancel the selected piece's move. MOVABLE: order
   * the selected piece there. OCCUPIED: select a current-player piece on it.
   */
  static panelChange(position: PanelPosition) {
    if (!this.isHumanInteractionAllowed()) return;
    const turn = TurnRepository.get();
    const selectedId = SelectionRepository.getPieceId();

    if (SelectionRepository.isRangedAttackMode()) {
      if (selectedId === undefined) return;
      const selected = PiecesRepository.get(selectedId);
      GameApiClient.assignRangedAttack(turn.player, selectedId, position);
      SelectionRepository.setRangedAttackMode(false);
      if (selected) this.stateChange(selected.panelPosition);
      return;
    }

    switch (PanelRepository.find(position)?.panelState) {
      case PanelState.SELECTED: {
        const selected = PiecesRepository.get(selectedId);
        if (selected?.targetPosition) {
          if (GameApiClient.cancelMove(selected.player, selected.id).ok) this.deselect();
          return;
        }
        break;
      }
      case PanelState.MOVABLE:
        if (
          selectedId !== undefined &&
          !GameApiClient.assignMove(turn.player, selectedId, position).ok
        ) {
          return;
        }
        break;
      case PanelState.OCCUPIED: {
        const own = PiecesRepository.getPiecesByPosition(position).filter(
          (p) => p.player === turn.player,
        );
        const piece = own.find((p) => !p.targetPosition) ?? own[0];
        if (piece) this.pieceChange(piece);
        return;
      }
      default:
        return;
    }
    this.stateChange(position);
  }

  /** Selects a current-player piece, or deselects it when clicked again. */
  static pieceChange(piece: Piece) {
    if (!this.isHumanInteractionAllowed()) return;
    if (piece.player !== TurnRepository.get().player) return;

    const wasSelected =
      SelectionRepository.getPieceId() === piece.id &&
      PanelRepository.find(piece.panelPosition)?.panelState === PanelState.SELECTED;
    PanelRepository.setAll(PanelsService.clearSelected());
    SelectionRepository.setPieceId(wasSelected ? undefined : piece.id);
    if (!wasSelected) this.stateChange(piece.panelPosition);
  }

  /** Highlights the targets of the piece on an unhighlighted panel; otherwise clears the selection. */
  static stateChange(position: PanelPosition) {
    const panel = PanelRepository.find(position);
    const highlighted =
      panel?.panelState === PanelState.SELECTED || panel?.panelState === PanelState.MOVABLE;
    if (panel && !highlighted && PiecesRepository.getPiecesByPosition(position).length > 0) {
      this.highlightTargets(panel);
    } else {
      this.deselect();
    }
  }

  /** Every panel the selected piece can be ordered to (any distance) becomes MOVABLE. */
  private static highlightTargets(source: Panel) {
    const pieces = PiecesRepository.getPiecesByPosition(source.panelPosition);
    const selected = pieces.find((p) => p.id === SelectionRepository.getPieceId()) ?? pieces[0];
    const maxPieces = TurnRepository.maxPieces(selected.player);
    const before = MovementRulesService.planEndOfTurn(selected.player, maxPieces);

    PanelRepository.setAll(
      PanelRepository.getAll().map((panel) => {
        if (samePos(panel.panelPosition, source.panelPosition)) {
          return { ...panel, panelState: PanelState.SELECTED };
        }
        const movable = MovementRulesService.canMoveTo(
          panel.panelPosition,
          selected.player,
          selected.id,
          maxPieces,
          before,
        );
        return movable ? { ...panel, panelState: PanelState.MOVABLE } : panel;
      }),
    );
  }

  private static deselect() {
    PanelRepository.setAll(PanelsService.clearSelected());
    this.clearSelection();
  }

  private static isHumanInteractionAllowed(): boolean {
    return (
      MatchService.getControllerForCurrentTurn() === "human" && !MatchService.isAutomationRunning()
    );
  }
}
