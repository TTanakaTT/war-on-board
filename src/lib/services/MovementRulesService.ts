import type { PanelPosition } from "$lib/domain/entities/PanelPosition";
import { Piece } from "$lib/domain/entities/Piece";
import type { PieceType } from "$lib/domain/enums/PieceType";
import { Player } from "$lib/domain/enums/Player";
import { PiecesRepository } from "$lib/data/repositories/PieceRepository";
import { PanelRepository } from "$lib/data/repositories/PanelRepository";
import { PanelsService } from "$lib/services/PanelService";
import {
  DEFAULT_MAX_PIECES_PER_PANEL,
  MOVEMENT_HOP_COST,
} from "$lib/domain/constants/GameConstants";

/**
 * MovementRulesService — pure query service for movement-related rules.
 *
 * Read-only: never writes to any repository. All methods are deterministic
 * queries used by InteractionService when computing which panels are MOVABLE.
 */
export class MovementRulesService {
  /**
   * Counts how many stacks `player` will have on `targetPosition` at the end of the turn,
   * counting each piece on every panel it occupies then (see `endOfTurnOccupancy`).
   * Mergeable pieces of the same type count as one stack.
   *
   * @param excludePieceId - Existing piece to leave out of the count.
   * @param includePieceId - Existing piece to count as if it ended the turn on `targetPosition`.
   * @param includePieceType - Type of a hypothetical piece (not on the board yet) to count as
   *   staying on `targetPosition`.
   */
  static projectedFriendlyStackCount(
    targetPosition: PanelPosition,
    player: Player,
    excludePieceId?: number,
    includePieceId?: number,
    includePieceType?: PieceType,
  ): number {
    const projectedMergeableTypes = new Set<string>();
    let projectedStackCount = 0;

    for (const piece of PiecesRepository.getPiecesByPlayer(player)) {
      if (piece.id === excludePieceId) continue;
      if (!this.endOfTurnOccupancy(piece).some((position) => position.equals(targetPosition))) {
        continue;
      }

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

    if (includePieceType) {
      if (includePieceType.config.mergeable) {
        projectedMergeableTypes.add(String(includePieceType));
      } else {
        projectedStackCount += 1;
      }
    }

    return projectedStackCount + projectedMergeableTypes.size;
  }

  /**
   * Panels <piece> takes up for its own side's capacity at the end of the current turn.
   *
   * - A piece that hops at most once per turn: its target when it moves to a panel without
   *   enemy presence, otherwise (no order, or an attack) its own panel.
   * - A piece that takes multiple turns per hop (see `Piece.takesMultipleTurnsPerHop`):
   *   - its own panel while it has nothing to do, stays, or winds up / makes an attack
   *     (an attacker stays put unless it breaks through);
   *   - only the hop panel when it completes a hop into a panel without enemy presence
   *     this turn (it leaves its own panel);
   *   - both its own panel and the hop panel while it is, or this turn becomes, between
   *     them — the piece is still on its own panel, and the hop panel is kept free for it.
   *
   * A slow piece is never counted on a final destination farther than its next hop: each
   * hop checks for room before it starts (see PieceService.finalizePlayerMoves).
   */
  static endOfTurnOccupancy(piece: Piece): PanelPosition[] {
    if (!piece.takesMultipleTurnsPerHop) {
      if (piece.targetPosition && !this.hasEnemyPresence(piece.targetPosition, piece.player)) {
        return [piece.targetPosition];
      }
      return [piece.panelPosition];
    }

    const hop = this.gradualHop(piece);
    if (!hop || hop.equals(piece.panelPosition)) return [piece.panelPosition];
    if (this.hasEnemyPresence(hop, piece.player)) return [piece.panelPosition];
    if (this.completesHopThisTurn(piece)) return [hop];
    return [piece.panelPosition, hop];
  }

  /**
   * The panel a piece that takes multiple turns per hop is working toward: the panel it
   * is moving into while in transit, otherwise the first step of the shortest path to its
   * target (its own panel when the target is that panel). Undefined without an order.
   */
  static gradualHop(piece: Piece): PanelPosition | undefined {
    if (piece.transitPosition) return piece.transitPosition;
    if (!piece.targetPosition) return undefined;
    const path = PanelsService.findShortestPath(piece.panelPosition, piece.targetPosition);
    return path && path.length >= 2 ? path[1] : piece.panelPosition;
  }

  /**
   * Whether the progress of a piece that takes multiple turns per hop reaches
   * MOVEMENT_HOP_COST at the end of this turn, completing its hop or attack.
   */
  static completesHopThisTurn(piece: Piece): boolean {
    return piece.movementPoints + piece.pieceType.config.movement >= MOVEMENT_HOP_COST;
  }

  /**
   * Whether <piece>'s order can no longer be changed or cancelled: a piece that takes
   * multiple turns per hop has started winding up an attack (it made progress without
   * leaving its panel). A piece in transit is not locked — only its current hop is fixed,
   * and its final destination can still change.
   */
  static isOrderLocked(piece: Piece): boolean {
    return (
      piece.takesMultipleTurnsPerHop &&
      !piece.isInTransit &&
      piece.targetPosition !== undefined &&
      piece.movementPoints > 0
    );
  }

  /**
   * <piece> as it would be right after being ordered to <target>. A piece that takes
   * multiple turns per hop starts its progress over, unless it is already in transit
   * (its current hop keeps going and only the final destination changes).
   */
  static withOrder(piece: Piece, target: PanelPosition): Piece {
    const restartsProgress = piece.takesMultipleTurnsPerHop && !piece.isInTransit;
    return new Piece({
      ...piece,
      targetPosition: target,
      movementPoints: restartsProgress ? 0 : piece.movementPoints,
    });
  }

  /**
   * Whether every panel <piece> (possibly a hypothetical state of an existing piece) takes
   * up at the end of the turn stays within <maxPieces> with it counted there.
   */
  static fitsAtEndOfTurn(piece: Piece, maxPieces: number): boolean {
    return this.endOfTurnOccupancy(piece).every(
      (position) =>
        this.projectedFriendlyStackCount(position, piece.player, piece.id, piece.id) <= maxPieces,
    );
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
   * Whether <attacker> may target a panel occupied by <defenders> at all.
   * Every defender's defense must be <= the attacker's raw base attack power
   * against pieces (not merge/stackCount adjusted — merge multiplies hit
   * count, never raw attack power). If even one defender's defense exceeds
   * it, the attacker cannot legally select this target — a hard block on
   * move/attack selection, distinct from dealing 0 damage. Only meaningful
   * when defenders are present; wall-only panels are never gated by this.
   */
  static canDefeatAllDefenders(attacker: Piece, defenders: Piece[]): boolean {
    return defenders.every((defender) => defender.defense <= attacker.attackPowerAgainstPiece);
  }

  /**
   * Determine whether <player>'s piece (id = selectedPieceId) can move to <targetPosition>.
   *
   * - A piece whose order is locked (see isOrderLocked) cannot be given a new one.
   * - Enemy panels → movable if the piece can attack and, when defenders are
   *   present, can defeat every one of them (see canDefeatAllDefenders). The target's
   *   capacity is irrelevant, but the attacker stays on its own panel unless it breaks
   *   through, so every panel it takes up at the end of the turn must have room for it.
   * - Friendly panels → movable only if the projected post-merge stack count on the target
   *   <= maxPieces, and every panel the piece takes up at the end of the turn (for a slow
   *   piece, also the next hop it starts this turn) has room for it.
   */
  static canMoveTo(
    targetPosition: PanelPosition,
    player: Player,
    selectedPieceId: number,
    maxPieces: number = DEFAULT_MAX_PIECES_PER_PANEL,
  ): boolean {
    const piece = PiecesRepository.getAll().find((candidate) => candidate.id === selectedPieceId);
    if (!piece) return false;
    if (this.isOrderLocked(piece)) return false;
    const orderedPiece = this.withOrder(piece, targetPosition);

    if (this.hasEnemyPresence(targetPosition, player)) {
      if (!piece.canAttack) return false;

      const defenders = PiecesRepository.getPiecesByPosition(targetPosition).filter(
        (p) => p.player !== player && p.player !== Player.UNKNOWN,
      );
      if (defenders.length > 0 && !this.canDefeatAllDefenders(piece, defenders)) return false;

      return this.fitsAtEndOfTurn(orderedPiece, maxPieces);
    }

    const projectedStackCount = this.projectedFriendlyStackCount(
      targetPosition,
      player,
      selectedPieceId,
      selectedPieceId,
    );
    if (projectedStackCount > maxPieces) return false;

    return this.fitsAtEndOfTurn(orderedPiece, maxPieces);
  }

  /**
   * Whether <position> blocks travel through it toward a farther target, from
   * <player>'s perspective: either enemy presence (piece or wall — engaging it
   * mid-transit isn't a plain pass-through) or a friendly panel already at/over
   * capacity. Only meaningful for intermediate hops — the final destination of a
   * move/attack is validated separately (see canMoveTo/canDefeatAllDefenders).
   */
  static isTransitObstacle(
    position: PanelPosition,
    player: Player,
    maxPieces: number = DEFAULT_MAX_PIECES_PER_PANEL,
  ): boolean {
    if (this.hasEnemyPresence(position, player)) return true;
    return this.projectedFriendlyStackCount(position, player) >= maxPieces;
  }

  /**
   * Whether <attackerId> may fire a ranged attack (GameApi.assignRangedAttack)
   * at <targetPosition> without moving there. Requires the panel distance to
   * be farther than adjacent (distance 1 is always handled by canMoveTo's
   * ordinary attack path) but no farther than the attacker's own attackRange,
   * enemy pieces present at the target (and no enemy castle wall there —
   * PieceService.resolveRangedAttacks never deals wall damage, so a walled
   * panel is never a valid ranged-attack target), and every defending piece
   * defeatable (see canDefeatAllDefenders). Reused both by
   * GameApi.assignRangedAttack's validation and by the board UI to highlight
   * valid targets.
   */
  static canRangedAttack(attackerId: number, targetPosition: PanelPosition): boolean {
    const piece = PiecesRepository.getAll().find((candidate) => candidate.id === attackerId);
    if (!piece) return false;

    const path = PanelsService.findShortestPath(piece.panelPosition, targetPosition);
    const distance = path ? path.length - 1 : Infinity;
    if (distance <= 1 || distance > piece.attackRange) return false;

    const targetPanel = PanelRepository.find(targetPosition);
    if (
      targetPanel &&
      targetPanel.player !== piece.player &&
      targetPanel.player !== Player.UNKNOWN &&
      targetPanel.castle > 0
    ) {
      return false;
    }

    const defenders = PiecesRepository.getPiecesByPosition(targetPosition).filter(
      (p) => p.player !== piece.player && p.player !== Player.UNKNOWN,
    );
    if (defenders.length === 0) return false;

    return this.canDefeatAllDefenders(piece, defenders);
  }

  /**
   * Check whether cancelling a piece's pending move is allowed.
   *
   * - A piece whose order is locked (see isOrderLocked) cannot cancel it.
   * - A piece in transit cancels by stopping at the panel it is moving into, so it can
   *   cancel unless it is already headed nowhere farther.
   * - Otherwise the piece stays on its current panel, which must not exceed capacity.
   */
  static canCancelMove(
    pieceCurrentPosition: PanelPosition,
    player: Player,
    pieceId: number,
    maxPieces: number = DEFAULT_MAX_PIECES_PER_PANEL,
  ): boolean {
    const piece = PiecesRepository.getAll().find((candidate) => candidate.id === pieceId);
    if (piece && this.isOrderLocked(piece)) return false;
    if (piece?.transitPosition) {
      return !piece.targetPosition?.equals(piece.transitPosition);
    }

    const projectedStackCount = this.projectedFriendlyStackCount(
      pieceCurrentPosition,
      player,
      pieceId,
      pieceId,
    );
    return projectedStackCount <= maxPieces;
  }
}
