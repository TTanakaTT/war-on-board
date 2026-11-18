import { Piece } from "#lib/domain/entities/Piece.ts";
import { PiecesRepository } from "#lib/data/repositories/PieceRepository.ts";
import type { PanelPosition } from "#lib/domain/entities/PanelPosition.ts";
import type { CombatOutcome } from "#lib/domain/types/api.ts";
import type { BoardPoint } from "#lib/domain/types/boardPoint.ts";
import { Player } from "#lib/domain/enums/Player.ts";
import { Panel } from "#lib/domain/entities/Panel.ts";
import { PanelRepository } from "#lib/data/repositories/PanelRepository.ts";
import { PanelState } from "#lib/domain/enums/PanelState.ts";
import { PieceType } from "#lib/domain/enums/PieceType.ts";
import { CombatService } from "#lib/services/CombatService.ts";
import { PanelsService } from "#lib/services/PanelService.ts";
import { MovementRulesService, type TurnStep } from "#lib/services/MovementRulesService.ts";
import {
  PASSIVE_RESOURCE_CAP,
  PASSIVE_CASTLE_CAP,
  MOVEMENT_HOP_COST,
  DEFAULT_MAX_PIECES_PER_PANEL,
} from "#lib/domain/constants/GameConstants.ts";
import { MatchStatsRepository } from "#lib/data/repositories/MatchStatsRepository.ts";
import { TurnRepository } from "#lib/data/repositories/TurnRepository.ts";

function pointOnPanel(position: PanelPosition): BoardPoint {
  return { from: position, to: position, progress: 0 };
}

export class PieceService {
  /**
   * Merge all mergeable pieces of the same type and player at the given panel position.
   *
   * For each group (player × pieceType) where pieceType.config.mergeable === true
   * and the group has more than one piece (pieces in transit are left out — they join
   * only once they arrive or return):
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
      if (piece.isInTransit) continue;
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
      orderSequence: selectedPiece.orderSequence,
    });
    PiecesRepository.update(newPiece);
  }

  /**
   * Movement points accrued this turn, capped so a piece never banks more
   * than max(movementRate, MOVEMENT_HOP_COST). A movementRate below
   * MOVEMENT_HOP_COST (e.g. 0.5) would take multiple turns to reach the cap, but such
   * pieces do not bank points at all (see accrueMovementForPlayer).
   */
  static computeAccruedMovementPoints(currentPoints: number, movementRate: number): number {
    const cap = Math.max(movementRate, MOVEMENT_HOP_COST);
    return Math.min(cap, currentPoints + movementRate);
  }

  /**
   * Accrue movement points for <player>'s pieces at the start of their turn. A piece that
   * takes multiple turns per hop is skipped: its movementPoints is hop progress, advanced
   * by finalizePlayerMoves instead, and never banked while idle.
   */
  static accrueMovementForPlayer(player: Player): void {
    const pieces = PiecesRepository.getPiecesByPlayer(player).filter(
      (piece) => !piece.takesMultipleTurnsPerHop,
    );
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

  /** Where <piece> is drawn now: on its panel, or part of the way to the panel it is moving into. */
  static currentBoardPoint(piece: Piece): BoardPoint {
    if (!piece.transitPosition) return pointOnPanel(piece.panelPosition);
    return {
      from: piece.panelPosition,
      to: piece.transitPosition,
      progress: piece.movementPoints / MOVEMENT_HOP_COST,
    };
  }

  /**
   * Read-only preview of where <piece> will be at the end of the current turn if
   * finalizePlayerMoves ran right now (see MovementRulesService.planEndOfTurn) — part of the
   * way between two panels for a piece that takes multiple turns per hop. An attack is shown
   * at the attacked panel regardless of whether the attacker will break through.
   */
  static previewEndOfTurnPoint(piece: Piece): BoardPoint {
    const turn = TurnRepository.get();
    const maxPieces = turn.maxPiecesPerPanel[String(piece.player)] ?? DEFAULT_MAX_PIECES_PER_PANEL;
    const step = MovementRulesService.planEndOfTurn(piece.player, maxPieces).get(piece.id)?.step;
    const progress = (piece.movementPoints + piece.pieceType.config.movement) / MOVEMENT_HOP_COST;

    switch (step?.kind) {
      case "advance":
      case "blocked":
        return pointOnPanel(step.path.at(-1) ?? piece.panelPosition);
      case "enter":
        return pointOnPanel(step.path.at(-1)!);
      case "attack":
        return pointOnPanel(step.target);
      case "startTransit":
        return { from: piece.panelPosition, to: step.hop, progress };
      case "continueTransit":
        return { from: piece.panelPosition, to: piece.transitPosition!, progress };
      default:
        return pointOnPanel(piece.panelPosition);
    }
  }

  /** <piece> after walking <path> (this turn's panels), each costing MOVEMENT_HOP_COST. */
  private static walk(piece: Piece, path: PanelPosition[]): Piece {
    const end = path.at(-1);
    if (!end) return piece;
    return new Piece({
      ...piece,
      panelPosition: end,
      initialPosition: end,
      movementPoints: piece.movementPoints - path.length * MOVEMENT_HOP_COST,
    });
  }

  /**
   * Apply <piece>'s planned <step> (see MovementRulesService.planEndOfTurn). Entering its
   * target and attacking are not resolved here: the piece is moved to where it engages from
   * and returned with the panel it engages, to be resolved together with the other pieces
   * engaging the same panel (see finalizePlayerMoves).
   */
  private static applyStep(
    piece: Piece,
    step: TurnStep,
  ): { piece: Piece; target: PanelPosition } | undefined {
    const slow = piece.takesMultipleTurnsPerHop;
    const progress = piece.movementPoints + piece.pieceType.config.movement;

    switch (step.kind) {
      case "idle":
        return undefined;
      case "stay":
        if (slow) {
          PiecesRepository.update(
            new Piece({
              ...piece,
              targetPosition: undefined,
              transitPosition: undefined,
              movementPoints: 0,
            }),
          );
        } else {
          this.move(piece.panelPosition, piece);
        }
        return undefined;
      case "advance":
        PiecesRepository.update(this.walk(piece, step.path));
        return undefined;
      case "blocked":
        PiecesRepository.update(
          slow
            ? new Piece({
                ...piece,
                targetPosition: undefined,
                transitPosition: undefined,
                movementPoints: 0,
              })
            : new Piece({ ...this.walk(piece, step.path), targetPosition: undefined }),
        );
        return undefined;
      case "enter": {
        const hop = step.path.at(-1)!;
        if (!slow) {
          const engaging = this.walk(piece, step.path.slice(0, -1));
          PiecesRepository.update(engaging);
          return { piece: engaging, target: hop };
        }
        if (piece.targetPosition?.equals(hop)) {
          const engaging = new Piece({
            ...piece,
            transitPosition: undefined,
            movementPoints: progress,
          });
          PiecesRepository.update(engaging);
          return { piece: engaging, target: hop };
        }
        // An intermediate hop: arrive and keep heading for the final target.
        PiecesRepository.update(
          new Piece({
            ...piece,
            panelPosition: hop,
            initialPosition: hop,
            transitPosition: undefined,
            movementPoints: progress - MOVEMENT_HOP_COST,
          }),
        );
        return undefined;
      }
      case "attack": {
        const engaging = slow
          ? new Piece({ ...piece, transitPosition: undefined, movementPoints: progress })
          : this.walk(piece, step.path);
        PiecesRepository.update(engaging);
        return { piece: engaging, target: step.target };
      }
      case "windUp":
      case "continueTransit":
        PiecesRepository.update(new Piece({ ...piece, movementPoints: progress }));
        return undefined;
      case "startTransit":
        PiecesRepository.update(
          new Piece({ ...piece, transitPosition: step.hop, movementPoints: progress }),
        );
        return undefined;
    }
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
   *   4. Surviving attackers may enter only when no enemy pieces remain and the wall is gone.
   *   5. When combat occurred (wall or pieces), they enter one at a time in order sequence
   *      (see MovementRulesService.compareOrderSequence), each only if the attackers that
   *      entered in this resolution, itself included, still number at most <maxPieces> after
   *      merging (see MovementRulesService.mergedStackCount). A piece that does not fit
   *      stays where it attacked from like a failed attacker; later pieces are still checked,
   *      so one that merges with an entered piece may still enter. Only pieces entered in
   *      this resolution are counted: the panel held none of the attacker's pieces before the
   *      attack.
   *   6. Without combat (a plain move into a panel with no enemy pieces or wall), every
   *      piece enters: the end-of-turn plan (MovementRulesService.planEndOfTurn) already gave
   *      it room there, and counting pieces still on the panel here would wrongly block a
   *      piece taking the place of one that leaves later in this same turn.
   *
   * Damage is never resolved by selecting a single front-line defender, and does not depend
   * on order sequence: every attacker fights simultaneously. Group damage is distributed
   * across all recipients in proportion to their current HP.
   *
   * @param maxPieces - The attacker's maxPiecesPerPanel.
   * @returns CombatOutcome if wall or piece combat occurred, null if the target was empty.
   */
  private static resolveTargetPanel(
    attackers: Piece[],
    targetPosition: PanelPosition,
    maxPieces: number,
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
    const hadAnyCombat = hadWallCombat || hasCombat;

    const entered: Piece[] = [];
    const inOrderSequence = [...attackers].sort((a, b) =>
      MovementRulesService.compareOrderSequence(a, b),
    );
    for (const atk of inOrderSequence) {
      if (deadIds.has(atk.id)) continue;
      const current = PiecesRepository.getAll().find((p) => p.id === atk.id);
      if (!current) continue;

      const fits =
        !hadAnyCombat || MovementRulesService.mergedStackCount([...entered, current]) <= maxPieces;
      if (canEnter && fits) {
        this.move(targetPosition, current);
        entered.push(current);
      } else {
        // Reaching this branch means an attack was actually attempted (wall or piece combat
        // occurred) but didn't fully succeed, or succeeded with the panel already full — it
        // still costs a movement point, same as a successful move, regardless of outcome.
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

    if (!hadAnyCombat) return null;

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
   * Finalize all pending moves for a player by applying the end-of-turn plan
   * (MovementRulesService.planEndOfTurn), decided for every piece before anything moves.
   *
   * Pieces walk the panels the plan gives them. A piece blocked on its way stops where the plan
   * leaves it and its order is cancelled; a piece that does not reach its target this turn
   * keeps its order for a later turn. A piece that takes multiple turns per hop moves between
   * panels over several turns (see Piece.transitPosition) and winds an attack up over several
   * turns.
   *
   * Every engaging piece — entering its target, attacking its target, or attacking an enemy
   * panel in its way — is grouped by the panel it engages, and each panel is resolved once by
   * resolveTargetPanel: the group fights simultaneously, and after capturing an enemy panel its
   * pieces enter in order sequence (Piece.orderSequence) until the panel is full, the rest
   * staying where they attacked from with their order cleared. Attacking an enemy panel in its
   * way always cancels a piece's order, whether or not it enters that panel. An attack that
   * fails to break through leaves a slow piece on its own panel with its order cancelled —
   * including a piece in transit whose destination the enemy entered meanwhile.
   *
   * @returns Combat outcomes for groups where combat occurred.
   */
  static finalizePlayerMoves(player: Player): CombatOutcome[] {
    const turn = TurnRepository.get();
    const maxPieces = turn.maxPiecesPerPanel[String(player)] ?? DEFAULT_MAX_PIECES_PER_PANEL;
    const plan = MovementRulesService.planEndOfTurn(player, maxPieces);

    const engagements: { piece: Piece; target: PanelPosition }[] = [];
    for (const piece of PiecesRepository.getPiecesByPlayer(player)) {
      const step = plan.get(piece.id)?.step;
      if (!step) continue;
      const engagement = this.applyStep(piece, step);
      if (engagement) engagements.push(engagement);
    }

    const outcomes: CombatOutcome[] = [];

    // Engagements, grouped by target panel: every piece engaging a panel fights there
    // together and enters in one order sequence.
    const groups = new Map<string, { attackers: Piece[]; target: PanelPosition }>();
    for (const { piece, target } of engagements) {
      const key = `${target.horizontalLayer},${target.verticalLayer}`;
      const group = groups.get(key);
      if (group) {
        group.attackers.push(piece);
      } else {
        groups.set(key, { attackers: [piece], target });
      }
    }
    for (const { attackers, target } of groups.values()) {
      const outcome = this.resolveTargetPanel(attackers, target, maxPieces);
      if (outcome) outcomes.push(outcome);
    }

    return outcomes;
  }

  /**
   * Resolve all pending ranged attacks for a player (see GameApi.assignRangedAttack).
   *
   * Unlike finalizePlayerMoves, a ranged attacker never moves — it stays at its
   * current panel and fires at rangedAttackTargetPosition. Attackers targeting the
   * same panel are grouped and resolved as simultaneous combat via
   * CombatService.resolveCombat, passing the actual panel distance so defenders
   * whose own attackRange can't reach that far don't counterattack. Every attacker's
   * rangedAttackTargetPosition is cleared and a MOVEMENT_HOP_COST spent regardless of
   * outcome — firing is the action, whether or not the target is destroyed.
   *
   * @returns Combat outcomes for groups where combat occurred.
   */
  static resolveRangedAttacks(player: Player): CombatOutcome[] {
    const pieces = PiecesRepository.getPiecesByPlayer(player).filter(
      (p) => p.rangedAttackTargetPosition && p.movementPoints >= MOVEMENT_HOP_COST,
    );

    const groups = new Map<string, { attackers: Piece[]; target: PanelPosition }>();
    for (const piece of pieces) {
      const tp = piece.rangedAttackTargetPosition!;
      const key = `${tp.horizontalLayer},${tp.verticalLayer}`;
      const group = groups.get(key);
      if (group) {
        group.attackers.push(piece);
      } else {
        groups.set(key, { attackers: [piece], target: tp });
      }
    }

    const outcomes: CombatOutcome[] = [];
    for (const { attackers, target } of groups.values()) {
      for (const attacker of attackers) {
        PiecesRepository.update(
          new Piece({
            ...attacker,
            rangedAttackTargetPosition: undefined,
            movementPoints: attacker.movementPoints - MOVEMENT_HOP_COST,
          }),
        );
      }

      const defenders = PiecesRepository.getPiecesByPosition(target).filter(
        (p) => p.player !== player && p.player !== Player.UNKNOWN,
      );
      if (defenders.length === 0) continue;

      const path = PanelsService.findShortestPath(attackers[0].panelPosition, target);
      const distance = path ? path.length - 1 : attackers[0].attackRange;
      const { deadIds } = CombatService.resolveCombat(attackers, defenders, distance);

      outcomes.push({
        targetPosition: {
          horizontalLayer: target.horizontalLayer,
          verticalLayer: target.verticalLayer,
        },
        destroyedPieceIds: [...deadIds],
        entered: false,
        wallDamageDealt: 0,
      });
    }

    return outcomes;
  }
}
