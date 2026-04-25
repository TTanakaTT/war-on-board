import type { PanelPosition } from "$lib/domain/entities/PanelPosition";
import { Player } from "$lib/domain/enums/Player";
import { PiecesRepository } from "$lib/data/repositories/PieceRepository";
import { PanelRepository } from "$lib/data/repositories/PanelRepository";
import { DEFAULT_MAX_PIECES_PER_PANEL } from "$lib/domain/constants/GameConstants";

/**
 * MovementRulesService — pure query service for movement-related rules.
 *
 * Read-only: never writes to any repository. All methods are deterministic
 * queries used by InteractionService when computing which panels are MOVABLE.
 */
export class MovementRulesService {
  static projectedFriendlyStackCount(
    targetPosition: PanelPosition,
    player: Player,
    excludePieceId?: number,
    includePieceId?: number,
  ): number {
    const projectedMergeableTypes = new Set<string>();
    let projectedStackCount = 0;

    for (const piece of PiecesRepository.getPiecesByPlayer(player)) {
      if (piece.id === excludePieceId) continue;

      let destination: PanelPosition;
      if (piece.targetPosition) {
        const isAttack = this.hasEnemyPresence(piece.targetPosition, player);
        destination = isAttack ? piece.panelPosition : piece.targetPosition;
      } else {
        destination = piece.panelPosition;
      }

      if (!destination.equals(targetPosition)) continue;

      if (piece.pieceType.config.mergeable) {
        projectedMergeableTypes.add(String(piece.pieceType));
      } else {
        projectedStackCount += 1;
      }
    }

    if (includePieceId !== undefined) {
      const piece = PiecesRepository.getAll().find((candidate) => candidate.id === includePieceId);
      if (piece) {
        if (piece.pieceType.config.mergeable) {
          projectedMergeableTypes.add(String(piece.pieceType));
        } else {
          projectedStackCount += 1;
        }
      }
    }

    return projectedStackCount + projectedMergeableTypes.size;
  }

  /**
   * Check if a panel has enemy presence (enemy pieces or enemy-owned castle)
   * from the perspective of <player>.
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
   * Determine whether <player>'s piece (id = selectedPieceId) can move to <targetPosition>.
   *
   * - Enemy panels → always movable (attack target; capacity is irrelevant).
   * - Friendly panels → movable only if projected post-merge stack count <= maxPieces.
   */
  static canMoveTo(
    targetPosition: PanelPosition,
    player: Player,
    selectedPieceId: number,
    maxPieces: number = DEFAULT_MAX_PIECES_PER_PANEL,
  ): boolean {
    const piece = PiecesRepository.getAll().find((candidate) => candidate.id === selectedPieceId);
    if (!piece) return false;
    if (this.hasEnemyPresence(targetPosition, player)) {
      if (!piece.canAttack) return false;
      return true;
    }

    if (piece.panelPosition.equals(targetPosition)) {
      const projectedStackCount = this.projectedFriendlyStackCount(
        targetPosition,
        player,
        selectedPieceId,
        selectedPieceId,
      );
      return projectedStackCount <= maxPieces;
    }

    const projectedStackCount = this.projectedFriendlyStackCount(
      targetPosition,
      player,
      selectedPieceId,
      selectedPieceId,
    );

    return projectedStackCount <= maxPieces;
  }

  /**
   * Check whether cancelling a piece's pending move is allowed.
   * Cancel is blocked if returning the piece to its current panel would
   * exceed the capacity limit.
   */
  static canCancelMove(
    pieceCurrentPosition: PanelPosition,
    player: Player,
    pieceId: number,
    maxPieces: number = DEFAULT_MAX_PIECES_PER_PANEL,
  ): boolean {
    const projectedStackCount = this.projectedFriendlyStackCount(
      pieceCurrentPosition,
      player,
      pieceId,
      pieceId,
    );
    return projectedStackCount <= maxPieces;
  }
}
