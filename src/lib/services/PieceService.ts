import { Piece } from "$lib/domain/entities/Piece";
import { PiecesRepository } from "$lib/data/repositories/PieceRepository";
import type { PanelPosition } from "$lib/domain/entities/PanelPosition";
import type { CombatOutcome } from "$lib/domain/types/api";
import { Player } from "$lib/domain/enums/Player";
import { Panel } from "$lib/domain/entities/Panel";
import { PanelRepository } from "$lib/data/repositories/PanelRepository";
import { PanelState } from "$lib/domain/enums/PanelState";
import { PieceType } from "$lib/domain/enums/PieceType";
import { CombatService } from "$lib/services/CombatService";
import { PanelsService } from "$lib/services/PanelService";
import { MovementRulesService } from "$lib/services/MovementRulesService";
import {
  PASSIVE_RESOURCE_CAP,
  PASSIVE_CASTLE_CAP,
  MOVEMENT_HOP_COST,
  DEFAULT_MAX_PIECES_PER_PANEL,
} from "$lib/domain/constants/GameConstants";
import { MatchStatsRepository } from "$lib/data/repositories/MatchStatsRepository";
import { TurnRepository } from "$lib/data/repositories/TurnRepository";

export class PieceService {
  /**
   * Merge all mergeable pieces of the same type and player at the given panel position.
   *
   * For each group (player × pieceType) where pieceType.config.mergeable === true
   * and the group has more than one piece:
   *   - The piece with the lowest ID becomes the merged unit.
   *   - HP, maxHp, and stackCount are summed across all pieces in the group.
   *   - All other pieces in the group are removed from the repository.
   */
  static mergePiecesAtPosition(position: PanelPosition): void {
    const piecesAtPanel = PiecesRepository.getPiecesByPosition(position);

    // Group by player + pieceType
    const groups = new Map<string, Piece[]>();
    for (const piece of piecesAtPanel) {
      if (!piece.pieceType.config.mergeable) continue;
      const key = `${String(piece.player)}:${String(piece.pieceType)}`;
      const group = groups.get(key);
      if (group) {
        group.push(piece);
      } else {
        groups.set(key, [piece]);
      }
    }

    for (const group of groups.values()) {
      if (group.length < 2) continue;

      // Sort by ID — lowest ID is the base piece
      group.sort((a, b) => a.id - b.id);
      const [base, ...rest] = group;

      const totalHp = group.reduce((sum, p) => sum + p.hp, 0);
      const totalMaxHp = group.reduce((sum, p) => sum + p.maxHp, 0);
      const totalStackCount = group.reduce((sum, p) => sum + p.stackCount, 0);

      PiecesRepository.update(
        new Piece({
          ...base,
          hp: totalHp,
          maxHp: totalMaxHp,
          stackCount: totalStackCount,
        }),
      );

      for (const other of rest) {
        PiecesRepository.remove(other);
      }
    }
  }

  /**
   * Merge mergeable pieces at every panel position occupied by the given player.
   */
  static mergeAllPiecesForPlayer(player: Player): void {
    const playerPieces = PiecesRepository.getPiecesByPlayer(player);
    const uniquePositions = new Map<string, PanelPosition>();
    for (const piece of playerPieces) {
      const key = `${piece.panelPosition.horizontalLayer},${piece.panelPosition.verticalLayer}`;
      uniquePositions.set(key, piece.panelPosition);
    }
    for (const position of uniquePositions.values()) {
      this.mergePiecesAtPosition(position);
    }
  }

  static generateNextId(): number {
    return (
      PiecesRepository.getAll().reduce((max: number, piece: Piece) => Math.max(max, piece.id), 0) +
      1
    );
  }

  static move(panelPosition: PanelPosition, selectedPiece: Piece) {
    const newPiece = new Piece({
      id: selectedPiece.id,
      panelPosition: panelPosition,
      initialPosition: panelPosition,
      targetPosition: undefined,
      player: selectedPiece.player,
      pieceType: selectedPiece.pieceType,
      hp: selectedPiece.hp,
      stackCount: selectedPiece.stackCount,
      maxHp: selectedPiece.maxHp,
      movementPoints: selectedPiece.movementPoints - MOVEMENT_HOP_COST,
    });
    PiecesRepository.update(newPiece);
  }

  /**
   * Movement points accrued this turn, capped so a piece never banks more
   * than max(movementRate, MOVEMENT_HOP_COST). A movementRate below
   * MOVEMENT_HOP_COST (e.g. 0.5) takes multiple turns to reach the cap.
   */
  static computeAccruedMovementPoints(currentPoints: number, movementRate: number): number {
    const cap = Math.max(movementRate, MOVEMENT_HOP_COST);
    return Math.min(cap, currentPoints + movementRate);
  }

  static accrueMovementForPlayer(player: Player): void {
    const pieces = PiecesRepository.getPiecesByPlayer(player);
    pieces.forEach((piece: Piece) => {
      PiecesRepository.update(
        new Piece({
          ...piece,
          movementPoints: this.computeAccruedMovementPoints(
            piece.movementPoints,
            piece.pieceType.config.movement,
          ),
        }),
      );
    });
  }

  /**
   * Compute how far <piece> can advance this turn toward <destination> without
   * mutating anything, and whether a transit obstacle stops it short of that.
   * Always stops one panel short of the destination — the final hop (entry or
   * attack) is handled by resolveTargetPanel/move(), never here, so a hop is
   * never double-charged. When an intermediate panel is a transit obstacle
   * (see MovementRulesService.isTransitObstacle), stops there and reports it
   * via obstaclePosition — the caller resolves it as this turn's action
   * instead of continuing toward the original destination.
   */
  private static computeTravelAdvance(
    piece: Piece,
    destination: PanelPosition,
    maxPieces: number,
  ): { stopPosition: PanelPosition; hopsUsed: number; obstaclePosition?: PanelPosition } {
    const path = PanelsService.findShortestPath(piece.panelPosition, destination);
    if (!path || path.length < 2) return { stopPosition: piece.panelPosition, hopsUsed: 0 };

    const stopThreshold = path.length - 2; // index of the panel adjacent to destination
    let hopsBudget = Math.floor(piece.movementPoints / MOVEMENT_HOP_COST);
    let stopIndex = 0;

    for (let i = 1; i <= stopThreshold && hopsBudget > 0; i++) {
      if (MovementRulesService.isTransitObstacle(path[i], piece.player, maxPieces)) {
        return { stopPosition: path[stopIndex], hopsUsed: stopIndex, obstaclePosition: path[i] };
      }
      stopIndex = i;
      hopsBudget -= 1;
    }

    return { stopPosition: path[stopIndex], hopsUsed: stopIndex };
  }

  /**
   * Whether <position> is close enough to <target> to attempt entry/attack
   * this turn — either the same panel or adjacent to it.
   */
  private static isInEngagementRange(position: PanelPosition, target: PanelPosition): boolean {
    return position.equals(target) || position.isAdjacent(target);
  }

  /**
   * Read-only preview of where <piece> would attempt to act at the end of the
   * current turn if finalizePlayerMoves ran right now. Used by the board UI
   * to show "this turn's actual movement" instead of the final (possibly
   * distant) targetPosition. When a transit obstacle blocks the way, this
   * returns the obstacle panel itself (where the piece will attack/merge/be
   * blocked this turn), not the panel short of it — mirroring how an
   * already-in-range piece optimistically shows its actual target regardless
   * of whether entry will succeed. Always matches finalizePlayerMoves's real
   * outcome, since both rely on the same computeTravelAdvance.
   */
  static previewTravelStop(piece: Piece): PanelPosition {
    const target = piece.targetPosition;
    if (!target) return piece.panelPosition;
    if (this.isInEngagementRange(piece.panelPosition, target)) return target;

    const turn = TurnRepository.get();
    const maxPieces = turn.maxPiecesPerPanel[String(piece.player)] ?? DEFAULT_MAX_PIECES_PER_PANEL;
    const { stopPosition, obstaclePosition } = this.computeTravelAdvance(piece, target, maxPieces);
    return obstaclePosition ?? stopPosition;
  }

  static resetInitialPositions(player: Player) {
    const pieces = PiecesRepository.getPiecesByPlayer(player);
    for (const piece of pieces) {
      const newPiece = new Piece({
        ...piece,
        initialPosition: piece.panelPosition,
      });
      PiecesRepository.update(newPiece);
    }
  }

  /**
   * Resolve combat/movement for a group of attackers targeting the same panel.
   *
   * Flow:
   *   1. If the target is an enemy panel with castle > 0, all attackers hit the wall together.
   *   2. When wall damage overflows and defenders are present, the overflow is converted into
   *      proportional piece damage against the entire defender group.
   *   3. If there was no wall phase and defenders are present, attacker and defender groups
   *      exchange simultaneous proportional damage.
   *   4. Surviving attackers enter only when no enemy pieces remain and the wall is gone.
   *
   * Damage is never resolved by selecting a single front-line defender. Group damage is
   * distributed across all recipients in proportion to their current HP.
   *
   * @returns CombatOutcome if wall or piece combat occurred, null if the target was empty.
   */
  private static resolveTargetPanel(
    attackers: Piece[],
    targetPosition: PanelPosition,
  ): CombatOutcome | null {
    const targetPanel = PanelRepository.find(targetPosition);
    const attackerPlayer = attackers[0].player;

    const isEnemyPanel =
      targetPanel && targetPanel.player !== attackerPlayer && targetPanel.player !== Player.UNKNOWN;

    const defenders = PiecesRepository.getPiecesByPosition(targetPosition).filter(
      (p) => p.player !== attackerPlayer,
    );

    const hadWallCombat = Boolean(isEnemyPanel && targetPanel.castle > 0);
    let wallDamageDealt = 0;
    let deadIds = new Set<number>();

    if (targetPanel && hadWallCombat) {
      const wallAttackResult = CombatService.attackWallMulti(attackers, targetPanel);
      wallDamageDealt = wallAttackResult.wallDamageDealt;

      if (wallAttackResult.overflowPieceDamage > 0 && defenders.length > 0) {
        const overflowResult = CombatService.resolveOverflowCombat(
          attackers,
          defenders,
          wallAttackResult.overflowRatio,
        );
        deadIds = new Set([...deadIds, ...overflowResult.deadIds]);
      }
    }

    const hasCombat = defenders.length > 0;

    if (!hadWallCombat && hasCombat) {
      const result = CombatService.resolveCombat(attackers, defenders);
      deadIds = new Set([...deadIds, ...result.deadIds]);
    }

    // Re-read panel (may have been modified)
    const currentPanel = PanelRepository.find(targetPosition);

    // Check if the target is clear for entry
    const remainingEnemies = PiecesRepository.getPiecesByPosition(targetPosition).filter(
      (p) => p.player !== attackerPlayer,
    );
    const noWall =
      !currentPanel ||
      currentPanel.player === attackerPlayer ||
      currentPanel.player === Player.UNKNOWN ||
      currentPanel.castle <= 0;
    const canEnter = remainingEnemies.length === 0 && noWall;

    for (const atk of attackers) {
      if (deadIds.has(atk.id)) continue;
      const current = PiecesRepository.getAll().find((p) => p.id === atk.id);
      if (!current) continue;

      if (canEnter) {
        this.move(targetPosition, current);
      } else {
        // Reaching this branch means an attack was actually attempted (wall or piece combat
        // occurred) but didn't fully succeed — it still costs a movement point, same as a
        // successful move, regardless of outcome.
        PiecesRepository.update(
          new Piece({
            ...current,
            targetPosition: undefined,
            movementPoints: current.movementPoints - MOVEMENT_HOP_COST,
          }),
        );
      }
    }

    if (canEnter && currentPanel) {
      PanelRepository.update(
        new Panel({
          panelPosition: targetPosition,
          panelState: PanelState.OCCUPIED,
          player: attackerPlayer,
          resource: currentPanel.resource ?? 0,
          castle: currentPanel.castle ?? 0,
        }),
      );
    }

    if (!hadWallCombat && !hasCombat) return null;

    return {
      targetPosition: {
        horizontalLayer: targetPosition.horizontalLayer,
        verticalLayer: targetPosition.verticalLayer,
      },
      destroyedPieceIds: [...deadIds],
      entered: canEnter,
      wallDamageDealt,
    };
  }

  static applyPassiveGains(player: Player) {
    const pieces = PiecesRepository.getPiecesByPlayer(player);
    pieces.forEach((piece: Piece) => {
      const panel = PanelRepository.find(piece.panelPosition);
      if (!panel) return;

      if (piece.pieceType === PieceType.NOBLE) {
        PanelRepository.update(
          new Panel({
            ...panel,
            resource: Math.min(PASSIVE_RESOURCE_CAP, (panel.resource || 0) + 1),
          }),
        );
      } else if (piece.pieceType === PieceType.ROOK) {
        // Increase castle by 1, cap growth at PASSIVE_CASTLE_CAP but never reduce existing values above it (e.g. home base=10)
        const increased = Math.min(PASSIVE_CASTLE_CAP, (panel.castle || 0) + 1);
        const nextCastle = Math.max(panel.castle, increased);
        PanelRepository.update(
          new Panel({
            ...panel,
            castle: nextCastle,
          }),
        );
        MatchStatsRepository.addBuiltCastle(piece.player, nextCastle - panel.castle);
      } else {
        // Infantry and all future combat unit types claim the panel they occupy.
        PanelRepository.update(
          new Panel({
            ...panel,
            player: player,
          }),
        );
      }
    });
  }

  /**
   * Finalize all pending moves for a player.
   *
   * A piece whose targetPosition is farther than one hop away advances toward it
   * via computeTravelAdvance, stopping one panel short of the target. If it lands
   * in range (adjacent to or on the target) with movement points still remaining,
   * it proceeds to engage this same turn; otherwise its target and remaining
   * points are left untouched for a later turn's finalizePlayerMoves to continue
   * — UNLESS an intermediate panel blocks it (a transit obstacle, see
   * MovementRulesService.isTransitObstacle). Hitting an obstacle always resolves
   * this turn and always cancels the pending distant order afterward, regardless
   * of outcome:
   *   - An enemy-occupied (or enemy-walled) obstacle is engaged exactly like a
   *     direct target, via resolveTargetPanel (attack/wall combat, entering only
   *     if it's cleared).
   *   - A friendly panel already at capacity is entered (and later merged by
   *     mergeAllPiecesForPlayer) if this specific piece would still fit once
   *     merge-consolidation is accounted for (MovementRulesService.canMoveTo);
   *     otherwise the piece stays put, unable to proceed at all.
   *
   * Pieces that reach engagement range of their actual final target are grouped
   * by that target panel and resolved with simultaneous multi-unit combat,
   * exactly as for an already-adjacent piece.
   *
   * A piece whose banked movementPoints haven't yet reached MOVEMENT_HOP_COST is skipped
   * entirely — its pending target and points are left untouched, to be resolved on a later
   * turn once enough movement has accrued (see GameApi.assignMove for how a movement<1
   * piece's points are committed down to its rate on assignment).
   *
   * @returns Combat outcomes for groups where combat occurred.
   */
  static finalizePlayerMoves(player: Player): CombatOutcome[] {
    const turn = TurnRepository.get();
    const maxPieces = turn.maxPiecesPerPanel[String(player)] ?? DEFAULT_MAX_PIECES_PER_PANEL;

    const pieces = PiecesRepository.getPiecesByPlayer(player);
    const piecesWithMoves = pieces.filter(
      (p) => p.targetPosition && p.movementPoints >= MOVEMENT_HOP_COST,
    );

    const readyForEngagement: Piece[] = [];
    const enemyObstacleGroups = new Map<string, { attackers: Piece[]; target: PanelPosition }>();
    const friendlyObstacleEncounters: { piece: Piece; obstaclePosition: PanelPosition }[] = [];

    for (const piece of piecesWithMoves) {
      const target = piece.targetPosition!;

      if (this.isInEngagementRange(piece.panelPosition, target)) {
        readyForEngagement.push(piece);
        continue;
      }

      const { stopPosition, hopsUsed, obstaclePosition } = this.computeTravelAdvance(
        piece,
        target,
        maxPieces,
      );

      let current = piece;
      if (hopsUsed > 0) {
        current = new Piece({
          ...piece,
          panelPosition: stopPosition,
          initialPosition: stopPosition,
          movementPoints: piece.movementPoints - hopsUsed * MOVEMENT_HOP_COST,
        });
        PiecesRepository.update(current);
      }

      if (obstaclePosition) {
        if (MovementRulesService.hasEnemyPresence(obstaclePosition, player)) {
          const key = `${obstaclePosition.horizontalLayer},${obstaclePosition.verticalLayer}`;
          const group = enemyObstacleGroups.get(key);
          if (group) {
            group.attackers.push(current);
          } else {
            enemyObstacleGroups.set(key, { attackers: [current], target: obstaclePosition });
          }
        } else {
          friendlyObstacleEncounters.push({ piece: current, obstaclePosition });
        }
        continue;
      }

      if (
        this.isInEngagementRange(current.panelPosition, target) &&
        current.movementPoints >= MOVEMENT_HOP_COST
      ) {
        readyForEngagement.push(current);
      }
    }

    const outcomes: CombatOutcome[] = [];

    // Final-target engagements, grouped by target panel.
    const groups = new Map<string, { attackers: Piece[]; target: PanelPosition }>();
    for (const piece of readyForEngagement) {
      const tp = piece.targetPosition!;
      const key = `${tp.horizontalLayer},${tp.verticalLayer}`;
      const group = groups.get(key);
      if (group) {
        group.attackers.push(piece);
      } else {
        groups.set(key, { attackers: [piece], target: tp });
      }
    }
    for (const { attackers, target } of groups.values()) {
      const outcome = this.resolveTargetPanel(attackers, target);
      if (outcome) outcomes.push(outcome);
    }

    // Transit obstacles: always resolved (and the distant order cancelled) this turn.
    for (const { attackers, target } of enemyObstacleGroups.values()) {
      const outcome = this.resolveTargetPanel(attackers, target);
      if (outcome) outcomes.push(outcome);
    }
    for (const { piece, obstaclePosition } of friendlyObstacleEncounters) {
      if (MovementRulesService.canMoveTo(obstaclePosition, player, piece.id, maxPieces)) {
        this.move(obstaclePosition, piece);
      } else {
        PiecesRepository.update(
          new Piece({
            ...piece,
            targetPosition: undefined,
            movementPoints: piece.movementPoints - MOVEMENT_HOP_COST,
          }),
        );
      }
    }

    return outcomes;
  }
}
