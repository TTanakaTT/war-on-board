import { DEFAULT_MAX_PIECES_PER_PANEL, MOVEMENT_HOP_COST } from "#lib/domain/config.ts";
import {
  canAttack,
  isInTransit,
  pieceConfig,
  Player,
  posKey,
  samePos,
  takesMultipleTurnsPerHop,
  type PanelPosition,
  type Piece,
} from "#lib/domain/model.ts";
import { PanelRepository, PiecesRepository } from "#lib/store.svelte.ts";
import { PanelsService } from "#lib/services/PanelService.ts";

/**
 * What a piece does at the end of its owner's turn. `path` is this turn's panels in order.
 * - advance: walks toward a target it does not reach this turn (keeps its order).
 * - enter: enters the last panel of `path` (a slow piece's completed hop may fall short of
 *   its target; it then keeps its order).
 * - attack: walks `path`, then attacks `target` (its order ends either way).
 * - blocked: walks as far as it can; order cancelled.
 * - windUp / startTransit / continueTransit: progress of a slow piece.
 */
export type TurnStep =
  | { kind: "idle" }
  | { kind: "stay" }
  | { kind: "advance"; path: PanelPosition[] }
  | { kind: "enter"; path: PanelPosition[] }
  | { kind: "attack"; path: PanelPosition[]; target: PanelPosition }
  | { kind: "blocked"; path: PanelPosition[] }
  | { kind: "windUp"; target: PanelPosition }
  | { kind: "startTransit"; hop: PanelPosition }
  | { kind: "continueTransit" };

export interface PieceTurnPlan {
  step: TurnStep;
  /** Panels the piece takes up for its side's capacity at the end of the turn. */
  occupancy: PanelPosition[];
}

type MovedCycle = { occupancy: Occupancy; plans: [Piece, PieceTurnPlan][] };

interface MoveAttempt {
  plan?: PieceTurnPlan;
  /** Where the piece ends up, order cancelled, if it cannot act. */
  fallback: PieceTurnPlan;
  /** Friendly panels without room that stopped its routes. */
  blockers: PanelPosition[];
}

class Occupancy {
  private readonly byPanel = new Map<string, Piece[]>();

  add(position: PanelPosition, piece: Piece): void {
    const key = posKey(position);
    this.byPanel.set(key, [...(this.byPanel.get(key) ?? []), piece]);
  }

  remove(position: PanelPosition, piece: Piece): void {
    const key = posKey(position);
    this.byPanel.set(
      key,
      (this.byPanel.get(key) ?? []).filter((p) => p.id !== piece.id),
    );
  }

  stackCountWith(position: PanelPosition, piece?: Piece): number {
    const pieces = this.byPanel.get(posKey(position)) ?? [];
    return MovementRulesService.mergedStackCount(piece ? [...pieces, piece] : pieces);
  }

  clone(): Occupancy {
    const copy = new Occupancy();
    for (const [key, pieces] of this.byPanel) copy.byPanel.set(key, [...pieces]);
    return copy;
  }
}

/** Memoized lookups for one plan. */
class PlanContext {
  private readonly routes = new Map<number, PanelPosition[][]>();
  private readonly enemyPresence = new Map<string, boolean>();

  constructor(
    readonly player: Player,
    readonly maxPieces: number,
  ) {}

  /** This turn's panels of every shortest route (one panel for a slow piece). */
  routesOf(piece: Piece): PanelPosition[][] {
    let routes = this.routes.get(piece.id);
    if (!routes) {
      routes = PanelsService.shortestRoutePrefixes(
        piece.panelPosition,
        piece.targetPosition!,
        takesMultipleTurnsPerHop(piece) ? 1 : Math.floor(piece.movementPoints / MOVEMENT_HOP_COST),
      );
      this.routes.set(piece.id, routes);
    }
    return routes;
  }

  hasEnemyPresence(position: PanelPosition): boolean {
    const key = posKey(position);
    let present = this.enemyPresence.get(key);
    if (present === undefined) {
      present = MovementRulesService.hasEnemyPresence(position, this.player);
      this.enemyPresence.set(key, present);
    }
    return present;
  }
}

export class EndOfTurnPlan {
  constructor(
    private readonly plans: Map<number, PieceTurnPlan>,
    private readonly occupancy: Occupancy,
  ) {}

  get(pieceId: number): PieceTurnPlan | undefined {
    return this.plans.get(pieceId);
  }

  stackCount(position: PanelPosition): number {
    return this.occupancy.stackCountWith(position);
  }
}

/** Read-only movement rules. */
export class MovementRulesService {
  /**
   * Decides what each of <player>'s pieces does at the end of the turn. finalizePlayerMoves
   * applies it; order/cancel/generation checks and the board preview read it.
   * A piece counts on its panel until it leaves and only enters panels with room then.
   * 1. Stationary pieces are placed first (idle, staying, slow pieces in transit).
   * 2. Movers in order sequence: the earliest that can act does, then retry from the start.
   *    Each tries its shortest routes in order and takes the first not ending at a full
   *    friendly panel (or, for a non-attacker, an enemy panel).
   * 3. If none can act, movers waiting on each other's panels in a cycle move together.
   * 4. Otherwise the earliest mover walks as far as it can and its order is cancelled.
   */
  static planEndOfTurn(
    player: Player,
    maxPieces: number,
    pieces: Piece[] = PiecesRepository.getPiecesByPlayer(player),
  ): EndOfTurnPlan {
    const context = new PlanContext(player, maxPieces);
    let occupancy = new Occupancy();
    const plans = new Map<number, PieceTurnPlan>();
    const unresolved: Piece[] = [];

    for (const piece of pieces) {
      const plan = this.planStationary(piece);
      if (plan) {
        plans.set(piece.id, plan);
        for (const position of plan.occupancy) occupancy.add(position, piece);
      } else {
        unresolved.push(piece);
        occupancy.add(piece.panelPosition, piece);
      }
    }
    unresolved.sort((a, b) => this.compareOrderSequence(a, b));

    while (unresolved.length > 0) {
      const attempts = unresolved.map((piece) => this.planMove(piece, occupancy, context));
      const index = attempts.findIndex((attempt) => attempt.plan);
      if (index >= 0) {
        this.commit(unresolved[index], attempts[index].plan!, occupancy, plans);
        unresolved.splice(index, 1);
        continue;
      }

      const cycle = this.findMovableCycle(unresolved, attempts, occupancy, context);
      if (cycle) {
        occupancy = cycle.occupancy;
        for (const [piece, plan] of cycle.plans) {
          plans.set(piece.id, plan);
          unresolved.splice(unresolved.indexOf(piece), 1);
        }
        continue;
      }

      this.commit(unresolved[0], attempts[0].fallback, occupancy, plans);
      unresolved.shift();
    }

    return new EndOfTurnPlan(plans, occupancy);
  }

  private static planStationary(piece: Piece): PieceTurnPlan | undefined {
    const own = piece.panelPosition;
    const slow = takesMultipleTurnsPerHop(piece);

    if (slow && piece.transitPosition) {
      const hop = piece.transitPosition;
      const completes = this.completesHopThisTurn(piece);
      if (this.hasEnemyPresence(hop, piece.player)) {
        // The enemy entered its destination: attack it if possible, else turn back.
        if (!this.canAttackPanel(piece, hop)) {
          return { step: { kind: "blocked", path: [] }, occupancy: [own] };
        }
        return completes
          ? { step: { kind: "attack", path: [], target: hop }, occupancy: [own] }
          : { step: { kind: "continueTransit" }, occupancy: [own] };
      }
      return completes
        ? { step: { kind: "enter", path: [hop] }, occupancy: [hop] }
        : { step: { kind: "continueTransit" }, occupancy: [own, hop] };
    }

    const target = piece.targetPosition;
    if (!target || (!slow && piece.movementPoints < MOVEMENT_HOP_COST)) {
      return { step: { kind: "idle" }, occupancy: [own] };
    }
    if (samePos(target, own)) return { step: { kind: "stay" }, occupancy: [own] };
    return undefined;
  }

  /**
   * Walks this turn's panels of each route: an enemy panel is attacked if possible (else the
   * route is closed); any other panel needs room (passing through included).
   * A slow piece only looks at the first panel: wind up / attack, or start moving into it.
   */
  private static planMove(piece: Piece, occupancy: Occupancy, context: PlanContext): MoveAttempt {
    const own = piece.panelPosition;
    const { maxPieces } = context;
    const blockers: PanelPosition[] = [];

    if (takesMultipleTurnsPerHop(piece)) {
      const completes = this.completesHopThisTurn(piece);
      const fallback = this.blockedAt([], own);
      for (const [hop] of context.routesOf(piece)) {
        if (context.hasEnemyPresence(hop)) {
          if (!this.canAttackPanel(piece, hop)) continue;
          const step: TurnStep = completes
            ? { kind: "attack", path: [], target: hop }
            : { kind: "windUp", target: hop };
          return { plan: { step, occupancy: [own] }, fallback, blockers };
        }
        if (occupancy.stackCountWith(hop, piece) > maxPieces) {
          blockers.push(hop);
          continue;
        }
        const plan: PieceTurnPlan = completes
          ? { step: { kind: "enter", path: [hop] }, occupancy: [hop] }
          : { step: { kind: "startTransit", hop }, occupancy: [own, hop] };
        return { plan, fallback, blockers };
      }
      return { fallback, blockers };
    }

    let farthest: PanelPosition[] = [];
    for (const route of context.routesOf(piece)) {
      let walked = route.length;
      let blocker: PanelPosition | undefined;

      for (let i = 0; i < route.length; i++) {
        const position = route[i];
        if (context.hasEnemyPresence(position)) {
          if (this.canAttackPanel(piece, position)) {
            const path = route.slice(0, i);
            return {
              plan: {
                step: { kind: "attack", path, target: position },
                occupancy: [path.at(-1) ?? own],
              },
              fallback: this.blockedAt(farthest, own),
              blockers,
            };
          }
          walked = i;
          break;
        }
        if (occupancy.stackCountWith(position, piece) > maxPieces) {
          walked = i;
          blocker = position;
          break;
        }
      }

      if (walked === route.length) {
        const end = route.at(-1)!;
        const kind = samePos(end, piece.targetPosition) ? "enter" : "advance";
        return {
          plan: { step: { kind, path: route }, occupancy: [end] },
          fallback: this.blockedAt(farthest, own),
          blockers,
        };
      }
      if (blocker) blockers.push(blocker);
      if (walked > farthest.length) farthest = route.slice(0, walked);
    }

    return { fallback: this.blockedAt(farthest, own), blockers };
  }

  private static blockedAt(path: PanelPosition[], own: PanelPosition): PieceTurnPlan {
    return { step: { kind: "blocked", path }, occupancy: [path.at(-1) ?? own] };
  }

  private static commit(
    piece: Piece,
    plan: PieceTurnPlan,
    occupancy: Occupancy,
    plans: Map<number, PieceTurnPlan>,
  ): void {
    occupancy.remove(piece.panelPosition, piece);
    for (const position of plan.occupancy) occupancy.add(position, piece);
    plans.set(piece.id, plan);
  }

  /**
   * Movers that wait for each other's panels in a cycle and can all act once all have left.
   * Cycles are tried earliest member first, earlier movers and routes first.
   */
  private static findMovableCycle(
    unresolved: Piece[],
    attempts: MoveAttempt[],
    occupancy: Occupancy,
    context: PlanContext,
  ): MovedCycle | undefined {
    const waitsFor = unresolved.map((_, i) => {
      const indices: number[] = [];
      for (const blocker of attempts[i].blockers) {
        unresolved.forEach((other, j) => {
          if (j !== i && samePos(other.panelPosition, blocker) && !indices.includes(j)) {
            indices.push(j);
          }
        });
      }
      return indices;
    });

    for (let start = 0; start < unresolved.length; start++) {
      const search = (current: number, members: number[]): MovedCycle | undefined => {
        for (const next of waitsFor[current]) {
          if (next === start) {
            const moved = this.tryCycle(
              members.map((i) => unresolved[i]),
              occupancy,
              context,
            );
            if (moved) return moved;
          } else if (next > start && !members.includes(next)) {
            const moved = search(next, [...members, next]);
            if (moved) return moved;
          }
        }
        return undefined;
      };
      const moved = search(start, [start]);
      if (moved) return moved;
    }
    return undefined;
  }

  /** Whether <members> can all act after leaving their panels for good (in order sequence). */
  private static tryCycle(
    members: Piece[],
    occupancy: Occupancy,
    context: PlanContext,
  ): MovedCycle | undefined {
    const trial = occupancy.clone();
    for (const piece of members) trial.remove(piece.panelPosition, piece);

    const plans: [Piece, PieceTurnPlan][] = [];
    for (const piece of [...members].sort((a, b) => this.compareOrderSequence(a, b))) {
      const plan = this.planMove(piece, trial, context).plan;
      if (!plan || plan.occupancy.some((position) => samePos(position, piece.panelPosition))) {
        return undefined;
      }
      for (const position of plan.occupancy) trial.add(position, piece);
      plans.push([piece, plan]);
    }
    return { occupancy: trial, plans };
  }

  /** The step ends the order without carrying it out (blocked, or attacking something else). */
  static cancelsOrder(step: TurnStep, piece: Piece): boolean {
    if (step.kind === "blocked") return true;
    if (step.kind === "attack" || step.kind === "windUp") {
      return !samePos(piece.targetPosition, step.target);
    }
    return false;
  }

  /**
   * Whether replacing <player>'s pieces with change(pieces) keeps orders on track: the acting
   * piece's order is not cancelled and its panels stay within capacity, and no other order
   * that was being carried out gets cancelled.
   */
  private static keepsOrdersOnTrack(
    player: Player,
    maxPieces: number,
    change: (pieces: Piece[]) => Piece[],
    actingPieceId: number,
    before?: EndOfTurnPlan,
  ): boolean {
    const current = PiecesRepository.getPiecesByPlayer(player);
    const changed = change(current);
    before ??= this.planEndOfTurn(player, maxPieces, current);
    const after = this.planEndOfTurn(player, maxPieces, changed);

    const acting = after.get(actingPieceId);
    if (acting?.occupancy.some((position) => after.stackCount(position) > maxPieces)) {
      return false;
    }

    for (const piece of changed) {
      const afterStep = after.get(piece.id)?.step;
      if (!afterStep || !this.cancelsOrder(afterStep, piece)) continue;
      if (piece.id === actingPieceId) return false;

      const original = current.find((candidate) => candidate.id === piece.id);
      const beforeStep = before.get(piece.id)?.step;
      if (original && beforeStep && !this.cancelsOrder(beforeStep, original)) return false;
    }
    return true;
  }

  /** Lower order sequence first, pieces without one last, ties by lower ID. */
  static compareOrderSequence(a: Piece, b: Piece): number {
    const aSeq = a.orderSequence ?? Number.POSITIVE_INFINITY;
    const bSeq = b.orderSequence ?? Number.POSITIVE_INFINITY;
    if (aSeq !== bSeq) return aSeq < bSeq ? -1 : 1;
    return a.id - b.id;
  }

  /** Each mergeable type counts once; non-mergeable pieces count individually. */
  static mergedStackCount(pieces: Piece[]): number {
    const mergeableTypes = new Set<string>();
    let count = 0;
    for (const piece of pieces) {
      if (pieceConfig(piece.pieceType).mergeable) mergeableTypes.add(piece.pieceType);
      else count += 1;
    }
    return count + mergeableTypes.size;
  }

  static completesHopThisTurn(piece: Piece): boolean {
    return piece.movementPoints + pieceConfig(piece.pieceType).movement >= MOVEMENT_HOP_COST;
  }

  /** A slow piece that started winding up an attack can no longer change or cancel it. */
  static isOrderLocked(piece: Piece): boolean {
    return (
      takesMultipleTurnsPerHop(piece) &&
      !isInTransit(piece) &&
      piece.targetPosition !== undefined &&
      piece.movementPoints > 0
    );
  }

  /** A slow piece not in transit restarts its progress when ordered. */
  static withOrder(piece: Piece, target: PanelPosition): Piece {
    const restartsProgress = takesMultipleTurnsPerHop(piece) && !isInTransit(piece);
    return {
      ...piece,
      targetPosition: target,
      movementPoints: restartsProgress ? 0 : piece.movementPoints,
    };
  }

  /** The target is no farther than this turn's move (never true in transit). */
  static isWithinThisTurnsReach(piece: Piece, target: PanelPosition): boolean {
    if (isInTransit(piece)) return false;
    const path = PanelsService.findShortestPath(piece.panelPosition, target);
    if (!path) return false;
    const reach = takesMultipleTurnsPerHop(piece)
      ? 1
      : Math.floor(piece.movementPoints / MOVEMENT_HOP_COST);
    return path.length - 1 <= reach;
  }

  /** Enemy pieces or an enemy wall on the panel. */
  static hasEnemyPresence(position: PanelPosition, player: Player): boolean {
    if (this.enemiesAt(position, player).length > 0) return true;
    return this.hasEnemyWall(position, player);
  }

  /** Every defender's defense must be <= the attacker's raw (unmerged) attack. */
  static canDefeatAllDefenders(attacker: Piece, defenders: Piece[]): boolean {
    const attack = pieceConfig(attacker.pieceType).attackPowerAgainstPiece;
    return defenders.every((defender) => pieceConfig(defender.pieceType).defense <= attack);
  }

  static canAttackPanel(piece: Piece, position: PanelPosition): boolean {
    return (
      canAttack(piece) && this.canDefeatAllDefenders(piece, this.enemiesAt(position, piece.player))
    );
  }

  /**
   * A target within this turn's reach must be carried out this turn without cancelling
   * another order; one beyond it can always be ordered.
   */
  static canMoveTo(
    targetPosition: PanelPosition,
    player: Player,
    selectedPieceId: number,
    maxPieces: number = DEFAULT_MAX_PIECES_PER_PANEL,
    before?: EndOfTurnPlan,
  ): boolean {
    const piece = PiecesRepository.get(selectedPieceId);
    if (!piece || this.isOrderLocked(piece)) return false;
    if (!this.isWithinThisTurnsReach(piece, targetPosition)) return true;

    const ordered = this.withOrder(piece, targetPosition);
    return this.keepsOrdersOnTrack(
      player,
      maxPieces,
      (pieces) => pieces.map((p) => (p.id === piece.id ? ordered : p)),
      piece.id,
      before,
    );
  }

  /**
   * Distance 2..attackRange, enemy pieces present, no enemy wall (ranged attacks never
   * hit walls), and every defender defeatable.
   */
  static canRangedAttack(attackerId: number, targetPosition: PanelPosition): boolean {
    const piece = PiecesRepository.get(attackerId);
    if (!piece) return false;

    const path = PanelsService.findShortestPath(piece.panelPosition, targetPosition);
    const distance = path ? path.length - 1 : Infinity;
    if (distance <= 1 || distance > pieceConfig(piece.pieceType).attackRange) return false;
    if (this.hasEnemyWall(targetPosition, piece.player)) return false;

    const defenders = this.enemiesAt(targetPosition, piece.player);
    return defenders.length > 0 && this.canDefeatAllDefenders(piece, defenders);
  }

  static canCancelMove(
    player: Player,
    pieceId: number,
    maxPieces: number = DEFAULT_MAX_PIECES_PER_PANEL,
  ): boolean {
    const piece = PiecesRepository.get(pieceId);
    if (!piece || this.isOrderLocked(piece)) return false;
    if (piece.transitPosition) return !samePos(piece.targetPosition, piece.transitPosition);

    return this.keepsOrdersOnTrack(
      player,
      maxPieces,
      (pieces) => pieces.map((p) => (p.id === pieceId ? { ...p, targetPosition: undefined } : p)),
      pieceId,
    );
  }

  /** Whether <newPiece> (not on the board yet) can stay on its panel. */
  static canPlaceNewPiece(newPiece: Piece, maxPieces: number, before?: EndOfTurnPlan): boolean {
    return this.keepsOrdersOnTrack(
      newPiece.player,
      maxPieces,
      (pieces) => [...pieces, newPiece],
      newPiece.id,
      before,
    );
  }

  static enemiesAt(position: PanelPosition, player: Player): Piece[] {
    return PiecesRepository.getPiecesByPosition(position).filter(
      (p) => p.player !== player && p.player !== Player.UNKNOWN,
    );
  }

  private static hasEnemyWall(position: PanelPosition, player: Player): boolean {
    const panel = PanelRepository.find(position);
    return !!panel && panel.player !== player && panel.player !== Player.UNKNOWN && panel.wall > 0;
  }
}
