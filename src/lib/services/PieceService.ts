import { MOVEMENT_HOP_COST, PASSIVE_WALL_CAP, PASSIVE_RESOURCE_CAP } from "#lib/domain/config.ts";
import {
  isInTransit,
  PanelState,
  pieceConfig,
  PieceType,
  Player,
  posKey,
  samePos,
  takesMultipleTurnsPerHop,
  type BoardPoint,
  type CombatOutcome,
  type PanelPosition,
  type Piece,
} from "#lib/domain/model.ts";
import {
  MatchStatsRepository,
  PanelRepository,
  PiecesRepository,
  TurnRepository,
} from "#lib/store.svelte.ts";
import { CombatService } from "#lib/services/CombatService.ts";
import { MovementRulesService, type TurnStep } from "#lib/services/MovementRulesService.ts";
import { PanelsService } from "#lib/services/PanelService.ts";

const pointOnPanel = (position: PanelPosition): BoardPoint => ({
  from: position,
  to: position,
  progress: 0,
});

function groupByTarget(engagements: { piece: Piece; target: PanelPosition }[]) {
  const groups = new Map<string, { attackers: Piece[]; target: PanelPosition }>();
  for (const { piece, target } of engagements) {
    const group = groups.get(posKey(target));
    if (group) group.attackers.push(piece);
    else groups.set(posKey(target), { attackers: [piece], target });
  }
  return [...groups.values()];
}

export class PieceService {
  /** Merges same-player same-type mergeable pieces into the lowest ID (transit pieces wait). */
  static mergePiecesAtPosition(position: PanelPosition): void {
    const groups = new Map<string, Piece[]>();
    for (const piece of PiecesRepository.getPiecesByPosition(position)) {
      if (!pieceConfig(piece.pieceType).mergeable || isInTransit(piece)) continue;
      const key = `${piece.player}:${piece.pieceType}`;
      groups.set(key, [...(groups.get(key) ?? []), piece]);
    }

    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const [base, ...rest] = group.sort((a, b) => a.id - b.id);
      const sum = (field: "hp" | "maxHp" | "stackCount") =>
        group.reduce((total, p) => total + p[field], 0);
      PiecesRepository.update({
        ...base,
        hp: sum("hp"),
        maxHp: sum("maxHp"),
        stackCount: sum("stackCount"),
      });
      rest.forEach((other) => PiecesRepository.remove(other));
    }
  }

  static mergeAllPiecesForPlayer(player: Player): void {
    const positions = new Map(
      PiecesRepository.getPiecesByPlayer(player).map((p) => [posKey(p.panelPosition), p]),
    );
    for (const piece of positions.values()) this.mergePiecesAtPosition(piece.panelPosition);
  }

  static generateNextId(): number {
    return Math.max(0, ...PiecesRepository.getAll().map((p) => p.id)) + 1;
  }

  /** Moves the piece onto <panelPosition>, clearing its orders and spending one hop. */
  static move(panelPosition: PanelPosition, piece: Piece) {
    PiecesRepository.update({
      ...piece,
      panelPosition,
      initialPosition: panelPosition,
      targetPosition: undefined,
      rangedAttackTargetPosition: undefined,
      transitPosition: undefined,
      movementPoints: piece.movementPoints - MOVEMENT_HOP_COST,
    });
  }

  /** Banked points are capped at max(rate, MOVEMENT_HOP_COST). */
  static computeAccruedMovementPoints(currentPoints: number, movementRate: number): number {
    return Math.min(Math.max(movementRate, MOVEMENT_HOP_COST), currentPoints + movementRate);
  }

  /** Slow pieces are skipped: their points are hop progress, advanced at the end of the turn. */
  static accrueMovementForPlayer(player: Player): void {
    for (const piece of PiecesRepository.getPiecesByPlayer(player)) {
      if (takesMultipleTurnsPerHop(piece)) continue;
      PiecesRepository.update({
        ...piece,
        movementPoints: this.computeAccruedMovementPoints(
          piece.movementPoints,
          pieceConfig(piece.pieceType).movement,
        ),
      });
    }
  }

  static currentBoardPoint(piece: Piece): BoardPoint {
    if (!piece.transitPosition) return pointOnPanel(piece.panelPosition);
    return {
      from: piece.panelPosition,
      to: piece.transitPosition,
      progress: piece.movementPoints / MOVEMENT_HOP_COST,
    };
  }

  /** Where the piece will be drawn after this turn's plan (an attack shows at its target). */
  static previewEndOfTurnPoint(piece: Piece): BoardPoint {
    const maxPieces = TurnRepository.maxPieces(piece.player);
    const step = MovementRulesService.planEndOfTurn(piece.player, maxPieces).get(piece.id)?.step;
    const progress =
      (piece.movementPoints + pieceConfig(piece.pieceType).movement) / MOVEMENT_HOP_COST;

    switch (step?.kind) {
      case "advance":
      case "blocked":
      case "enter":
        return pointOnPanel(step.path.at(-1) ?? piece.panelPosition);
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

  private static walk(piece: Piece, path: PanelPosition[]): Piece {
    const end = path.at(-1);
    if (!end) return piece;
    return {
      ...piece,
      panelPosition: end,
      initialPosition: end,
      movementPoints: piece.movementPoints - path.length * MOVEMENT_HOP_COST,
    };
  }

  /**
   * Applies a planned step. Entering and attacking are not resolved here: the piece is moved to
   * where it engages from and returned with the panel it engages.
   */
  private static applyStep(
    piece: Piece,
    step: TurnStep,
  ): { piece: Piece; target: PanelPosition } | undefined {
    const slow = takesMultipleTurnsPerHop(piece);
    const progress = piece.movementPoints + pieceConfig(piece.pieceType).movement;
    const stopSlow = (): Piece => ({
      ...piece,
      targetPosition: undefined,
      transitPosition: undefined,
      movementPoints: 0,
    });
    const engage = (engaging: Piece, target: PanelPosition) => {
      PiecesRepository.update(engaging);
      return { piece: engaging, target };
    };

    switch (step.kind) {
      case "idle":
        return undefined;
      case "stay":
        if (slow) PiecesRepository.update(stopSlow());
        else this.move(piece.panelPosition, piece);
        return undefined;
      case "advance":
        PiecesRepository.update(this.walk(piece, step.path));
        return undefined;
      case "blocked":
        PiecesRepository.update(
          slow ? stopSlow() : { ...this.walk(piece, step.path), targetPosition: undefined },
        );
        return undefined;
      case "enter": {
        const hop = step.path.at(-1)!;
        if (!slow) return engage(this.walk(piece, step.path.slice(0, -1)), hop);
        if (samePos(piece.targetPosition, hop)) {
          return engage({ ...piece, transitPosition: undefined, movementPoints: progress }, hop);
        }
        // An intermediate hop: arrive and keep heading for the final target.
        PiecesRepository.update({
          ...piece,
          panelPosition: hop,
          initialPosition: hop,
          transitPosition: undefined,
          movementPoints: progress - MOVEMENT_HOP_COST,
        });
        return undefined;
      }
      case "attack":
        return engage(
          slow
            ? { ...piece, transitPosition: undefined, movementPoints: progress }
            : this.walk(piece, step.path),
          step.target,
        );
      case "windUp":
      case "continueTransit":
        PiecesRepository.update({ ...piece, movementPoints: progress });
        return undefined;
      case "startTransit":
        PiecesRepository.update({ ...piece, transitPosition: step.hop, movementPoints: progress });
        return undefined;
    }
  }

  static resetInitialPositions(player: Player) {
    for (const piece of PiecesRepository.getPiecesByPlayer(player)) {
      PiecesRepository.update({ ...piece, initialPosition: piece.panelPosition });
    }
  }

  /**
   * Resolves every attacker engaging one panel: wall first (overflow damages defenders), else
   * piece combat. Survivors enter only if no enemies and no wall remain; after combat they
   * enter in order sequence while the entered pieces (merged) fit within <maxPieces>, the rest
   * stay with their order cleared. A plain move (no combat) always enters: the plan made room.
   * Returns null when no combat happened.
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
    const enemies = () =>
      PiecesRepository.getPiecesByPosition(targetPosition).filter(
        (p) => p.player !== attackerPlayer,
      );
    const defenders = enemies();

    const hadWallCombat = Boolean(isEnemyPanel && targetPanel.wall > 0);
    let wallDamageDealt = 0;
    let deadIds = new Set<number>();

    if (targetPanel && hadWallCombat) {
      const wall = CombatService.attackWallMulti(attackers, targetPanel);
      wallDamageDealt = wall.wallDamageDealt;
      if (wall.overflowPieceDamage > 0 && defenders.length > 0) {
        deadIds = CombatService.resolveOverflowCombat(
          attackers,
          defenders,
          wall.overflowRatio,
        ).deadIds;
      }
    }
    const hasCombat = defenders.length > 0;
    if (!hadWallCombat && hasCombat) {
      deadIds = CombatService.resolveCombat(attackers, defenders).deadIds;
    }

    const currentPanel = PanelRepository.find(targetPosition);
    const noWall =
      !currentPanel ||
      currentPanel.player === attackerPlayer ||
      currentPanel.player === Player.UNKNOWN ||
      currentPanel.wall <= 0;
    const canEnter = enemies().length === 0 && noWall;
    const hadAnyCombat = hadWallCombat || hasCombat;

    const entered: Piece[] = [];
    const inOrder = [...attackers].sort((a, b) => MovementRulesService.compareOrderSequence(a, b));
    for (const attacker of inOrder) {
      if (deadIds.has(attacker.id)) continue;
      const current = PiecesRepository.get(attacker.id);
      if (!current) continue;
      const fits =
        !hadAnyCombat || MovementRulesService.mergedStackCount([...entered, current]) <= maxPieces;
      if (canEnter && fits) {
        this.move(targetPosition, current);
        entered.push(current);
      } else {
        // A failed or overflowing attack still spends the hop.
        PiecesRepository.update({
          ...current,
          targetPosition: undefined,
          movementPoints: current.movementPoints - MOVEMENT_HOP_COST,
        });
      }
    }

    if (canEnter && currentPanel) {
      PanelRepository.update({
        ...currentPanel,
        panelState: PanelState.OCCUPIED,
        player: attackerPlayer,
      });
    }

    if (!hadAnyCombat) return null;
    return {
      targetPosition: { ...targetPosition },
      destroyedPieceIds: [...deadIds],
      entered: canEnter,
      wallDamageDealt,
    };
  }

  /** Noble +1 resource, Rook +1 wall (capped, never lowered), others claim their panel. */
  static applyPassiveGains(player: Player) {
    for (const piece of PiecesRepository.getPiecesByPlayer(player)) {
      const panel = PanelRepository.find(piece.panelPosition);
      if (!panel) continue;

      if (piece.pieceType === PieceType.NOBLE) {
        PanelRepository.update({
          ...panel,
          resource: Math.min(PASSIVE_RESOURCE_CAP, panel.resource + 1),
        });
      } else if (piece.pieceType === PieceType.ROOK) {
        const wall = Math.max(panel.wall, Math.min(PASSIVE_WALL_CAP, panel.wall + 1));
        PanelRepository.update({ ...panel, wall });
        MatchStatsRepository.addBuiltWall(piece.player, wall - panel.wall);
      } else {
        PanelRepository.update({ ...panel, player });
      }
    }
  }

  /** Applies the end-of-turn plan, then resolves each engaged panel once with all its attackers. */
  static finalizePlayerMoves(player: Player): CombatOutcome[] {
    const maxPieces = TurnRepository.maxPieces(player);
    const plan = MovementRulesService.planEndOfTurn(player, maxPieces);

    const engagements: { piece: Piece; target: PanelPosition }[] = [];
    for (const piece of PiecesRepository.getPiecesByPlayer(player)) {
      const step = plan.get(piece.id)?.step;
      const engagement = step && this.applyStep(piece, step);
      if (engagement) engagements.push(engagement);
    }

    return groupByTarget(engagements)
      .map(({ attackers, target }) => this.resolveTargetPanel(attackers, target, maxPieces))
      .filter((outcome): outcome is CombatOutcome => outcome !== null);
  }

  /**
   * Ranged attackers fire from where they stand; defenders out of their own range do not
   * counter. Firing clears the order and spends a hop whatever the outcome.
   */
  static resolveRangedAttacks(player: Player): CombatOutcome[] {
    const shooters = PiecesRepository.getPiecesByPlayer(player).filter(
      (p) => p.rangedAttackTargetPosition && p.movementPoints >= MOVEMENT_HOP_COST,
    );
    const outcomes: CombatOutcome[] = [];
    const groups = groupByTarget(
      shooters.map((piece) => ({ piece, target: piece.rangedAttackTargetPosition! })),
    );
    for (const { attackers, target } of groups) {
      for (const attacker of attackers) {
        PiecesRepository.update({
          ...attacker,
          rangedAttackTargetPosition: undefined,
          movementPoints: attacker.movementPoints - MOVEMENT_HOP_COST,
        });
      }
      const defenders = MovementRulesService.enemiesAt(target, player);
      if (defenders.length === 0) continue;

      const path = PanelsService.findShortestPath(attackers[0].panelPosition, target);
      const distance = path ? path.length - 1 : pieceConfig(attackers[0].pieceType).attackRange;
      const { deadIds } = CombatService.resolveCombat(attackers, defenders, distance);
      outcomes.push({
        targetPosition: { ...target },
        destroyedPieceIds: [...deadIds],
        entered: false,
        wallDamageDealt: 0,
      });
    }
    return outcomes;
  }
}
