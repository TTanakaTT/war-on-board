import type { PanelPosition } from "#lib/domain/entities/PanelPosition.ts";
import { Piece } from "#lib/domain/entities/Piece.ts";
import { Player } from "#lib/domain/enums/Player.ts";
import { PiecesRepository } from "#lib/data/repositories/PieceRepository.ts";
import { PanelRepository } from "#lib/data/repositories/PanelRepository.ts";
import { PanelsService } from "#lib/services/PanelService.ts";
import {
  DEFAULT_MAX_PIECES_PER_PANEL,
  MOVEMENT_HOP_COST,
} from "#lib/domain/constants/GameConstants.ts";

/**
 * What a piece does at the end of its owner's turn (see MovementRulesService.planEndOfTurn).
 *
 * - `idle`: nothing — no order, or not enough movement points to act on it.
 * - `stay`: ordered to its own panel; the order is dropped.
 * - `advance`: walks `path` (this turn's panels, in order) toward a target it does not reach
 *   this turn, and keeps its order.
 * - `enter`: walks `path` and enters its last panel. For a piece that hops at most once per
 *   turn that panel is its target. For a piece that takes multiple turns per hop it is the hop
 *   it completes, possibly short of its target (it keeps its order then).
 * - `attack`: walks `path` (possibly empty) and attacks the enemy panel `target` — its own
 *   target, or an enemy panel in its way (its order is cancelled afterward either way).
 * - `blocked`: walks `path` as far as it can (possibly empty) and its order is cancelled.
 * - `windUp`: a slow piece makes progress toward attacking `target` without leaving its panel.
 * - `startTransit`: a slow piece leaves its panel toward the adjacent `hop`.
 * - `continueTransit`: a slow piece in transit keeps moving.
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

/** A piece's step at the end of the turn and the panels it takes up for its own side then. */
export interface PieceTurnPlan {
  step: TurnStep;
  /**
   * Panels the piece takes up for its own side's capacity at the end of the turn: where it
   * ends up (where it attacks from, for an attacker), or both its own panel and the panel it
   * is moving into for a slow piece in transit.
   */
  occupancy: PanelPosition[];
}

/** Movers that act together in a cycle (see MovementRulesService.findMovableCycle). */
interface MovedCycle {
  occupancy: Occupancy;
  plans: [Piece, PieceTurnPlan][];
}

/** What a mover could do now: its plan if it can act on its order, and its fallback if not. */
interface MoveAttempt {
  plan?: PieceTurnPlan;
  /** Where the piece ends up, its order cancelled, when it cannot act on its order. */
  fallback: PieceTurnPlan;
  /** Friendly panels without room that stopped its routes, in route order. */
  blockers: PanelPosition[];
}

function positionKey(position: PanelPosition): string {
  return `${position.horizontalLayer},${position.verticalLayer}`;
}

/** The pieces each panel holds for one side while a plan is being built. */
class Occupancy {
  private readonly byPanel = new Map<string, Piece[]>();

  add(position: PanelPosition, piece: Piece): void {
    const key = positionKey(position);
    this.byPanel.set(key, [...(this.byPanel.get(key) ?? []), piece]);
  }

  remove(position: PanelPosition, piece: Piece): void {
    const key = positionKey(position);
    this.byPanel.set(
      key,
      (this.byPanel.get(key) ?? []).filter((candidate) => candidate.id !== piece.id),
    );
  }

  /** Stack count on <position> after merging, with <piece> counted there as well. */
  stackCountWith(position: PanelPosition, piece?: Piece): number {
    const pieces = this.byPanel.get(positionKey(position)) ?? [];
    return MovementRulesService.mergedStackCount(piece ? [...pieces, piece] : pieces);
  }

  clone(): Occupancy {
    const copy = new Occupancy();
    for (const [key, pieces] of this.byPanel) copy.byPanel.set(key, [...pieces]);
    return copy;
  }
}

/** Lookups that stay the same while one plan is built: routes and enemy presence. */
class PlanContext {
  private readonly routes = new Map<number, PanelPosition[][]>();
  private readonly enemyPresence = new Map<string, boolean>();

  constructor(
    readonly player: Player,
    readonly maxPieces: number,
  ) {}

  /**
   * This turn's panels of every shortest route of mover <piece> (see
   * PanelsService.shortestRoutePrefixes): as many as its movement points allow, or just the
   * first one for a piece that takes multiple turns per hop.
   */
  routesOf(piece: Piece): PanelPosition[][] {
    let routes = this.routes.get(piece.id);
    if (!routes) {
      const length = piece.takesMultipleTurnsPerHop
        ? 1
        : Math.floor(piece.movementPoints / MOVEMENT_HOP_COST);
      routes = PanelsService.shortestRoutePrefixes(
        piece.panelPosition,
        piece.targetPosition!,
        length,
      );
      this.routes.set(piece.id, routes);
    }
    return routes;
  }

  hasEnemyPresence(position: PanelPosition): boolean {
    const key = positionKey(position);
    let present = this.enemyPresence.get(key);
    if (present === undefined) {
      present = MovementRulesService.hasEnemyPresence(position, this.player);
      this.enemyPresence.set(key, present);
    }
    return present;
  }
}

/**
 * Where every piece of one side will be at the end of its owner's turn and what it does then
 * (see MovementRulesService.planEndOfTurn).
 */
export class EndOfTurnPlan {
  constructor(
    private readonly plans: Map<number, PieceTurnPlan>,
    private readonly occupancy: Occupancy,
  ) {}

  get(pieceId: number): PieceTurnPlan | undefined {
    return this.plans.get(pieceId);
  }

  /** Stack count of the side on <position> at the end of the turn, after merging. */
  stackCount(position: PanelPosition): number {
    return this.occupancy.stackCountWith(position);
  }
}

/**
 * MovementRulesService — pure query service for movement-related rules.
 *
 * Read-only: never writes to any repository. All methods are deterministic queries used to
 * decide which orders are allowed and what pieces do at the end of the turn.
 */
export class MovementRulesService {
  /**
   * Plan the end of <player>'s turn: what each of <pieces> (default: the player's pieces on
   * the board) does and where it ends up. PieceService.finalizePlayerMoves applies this plan,
   * and every capacity rule (orders, cancellation, generation) and the board preview read it,
   * so they always agree.
   *
   * Every piece is counted on its panel until it is planned to leave it, and a piece moves
   * only into panels with room for it at that point, so no panel ends up over <maxPieces>.
   * Final destinations farther than this turn's move are never held in advance.
   *
   * - Pieces that do not move this turn are placed first: those without an order (or without
   *   enough movement points), those ordered to their own panel, and slow pieces in transit
   *   (on their own panel and on the panel they are moving into — only that panel when they
   *   arrive this turn, only their own panel when the enemy entered it).
   * - Every other piece is a mover, handled in order sequence (see compareOrderSequence). The
   *   earliest mover that can act on its order now does so, and the movers are tried again
   *   from the start, so an earlier mover waiting for room gets it as soon as a later one
   *   leaves.
   * - A mover tries the shortest routes to its target (see PanelsService.shortestRoutePrefixes)
   *   in order, walking this turn's panels of each (see planMove). It takes the first route
   *   that does not end at a friendly panel without room — or, for a non-attacker, at an enemy
   *   panel it cannot attack.
   * - When no mover can act, movers waiting for each other's panels in a cycle (A waits for B's
   *   panel, B for A's, and so on — through any of their routes) move together if every one of
   *   them can act once all of them have left.
   * - Otherwise the earliest waiting mover walks as far as it can along its routes (the route
   *   that gets farthest, the earlier one on a tie) and its order is cancelled.
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

  /** Plan of a piece that does not move this turn, or undefined for a mover. */
  private static planStationary(piece: Piece): PieceTurnPlan | undefined {
    const own = piece.panelPosition;

    if (piece.takesMultipleTurnsPerHop && piece.transitPosition) {
      const hop = piece.transitPosition;
      const completes = this.completesHopThisTurn(piece);
      if (this.hasEnemyPresence(hop, piece.player)) {
        // The enemy entered the panel it is moving into: it attacks there if it can, and
        // otherwise turns back to its own panel with its order cancelled.
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
    if (!target) return { step: { kind: "idle" }, occupancy: [own] };
    if (!piece.takesMultipleTurnsPerHop && piece.movementPoints < MOVEMENT_HOP_COST) {
      return { step: { kind: "idle" }, occupancy: [own] };
    }
    if (target.equals(own)) return { step: { kind: "stay" }, occupancy: [own] };
    return undefined;
  }

  /**
   * What mover <piece> can do given <occupancy> (which still counts it on its own panel).
   *
   * A piece that hops at most once per turn walks this turn's panels of a route — as many as
   * its movement points allow, its target included when it reaches it. Before each panel:
   * - enemy presence: a piece that can attack that panel (see canAttackPanel) attacks it from
   *   where it stands; for any other piece the route is closed;
   * - otherwise the panel needs room for the piece (passing through included), or the route
   *   is closed there;
   * - reaching its target, it enters it; otherwise it stops on the last panel and keeps its
   *   order.
   *
   * A piece that takes multiple turns per hop looks at the first panel of each route the same
   * way: an enemy panel it can attack is wound up toward and attacked once its progress
   * reaches MOVEMENT_HOP_COST; a panel with room is moved into over several turns (see
   * Piece.transitPosition).
   */
  private static planMove(piece: Piece, occupancy: Occupancy, context: PlanContext): MoveAttempt {
    const own = piece.panelPosition;
    const target = piece.targetPosition!;
    const { maxPieces } = context;
    const blockers: PanelPosition[] = [];

    if (piece.takesMultipleTurnsPerHop) {
      const completes = this.completesHopThisTurn(piece);
      for (const [hop] of context.routesOf(piece)) {
        if (context.hasEnemyPresence(hop)) {
          if (!this.canAttackPanel(piece, hop)) continue;
          const step: TurnStep = completes
            ? { kind: "attack", path: [], target: hop }
            : { kind: "windUp", target: hop };
          return { plan: { step, occupancy: [own] }, fallback: this.blockedAt([], own), blockers };
        }
        if (occupancy.stackCountWith(hop, piece) > maxPieces) {
          blockers.push(hop);
          continue;
        }
        const plan: PieceTurnPlan = completes
          ? { step: { kind: "enter", path: [hop] }, occupancy: [hop] }
          : { step: { kind: "startTransit", hop }, occupancy: [own, hop] };
        return { plan, fallback: this.blockedAt([], own), blockers };
      }
      return { fallback: this.blockedAt([], own), blockers };
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
        const step: TurnStep = end.equals(target)
          ? { kind: "enter", path: route }
          : { kind: "advance", path: route };
        return {
          plan: { step, occupancy: [end] },
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
   * Movers among <unresolved> (none of which can act now) that wait for each other's panels in
   * a cycle and can all act once every one of them has left its panel. A mover waits for
   * another when one of its routes is stopped by a friendly panel without room where the other
   * stands. Cycles are tried with their earliest member first, earlier movers and routes first.
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
          if (j !== i && other.panelPosition.equals(blocker) && !indices.includes(j)) {
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

  /**
   * Whether <members> can all act on their orders once all of them have left their panels,
   * each leaving its own panel for good. Tried in order sequence on a copy of <occupancy>.
   */
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
      if (!plan || plan.occupancy.some((position) => position.equals(piece.panelPosition))) {
        return undefined;
      }
      for (const position of plan.occupancy) trial.add(position, piece);
      plans.push([piece, plan]);
    }
    return { occupancy: trial, plans };
  }

  /**
   * Whether <step> ends <piece>'s order without carrying it out: the piece is blocked, or it
   * attacks (or winds up toward) an enemy panel in its way instead of its target.
   */
  static cancelsOrder(step: TurnStep, piece: Piece): boolean {
    if (step.kind === "blocked") return true;
    if (step.kind === "attack" || step.kind === "windUp") {
      return !piece.targetPosition?.equals(step.target);
    }
    return false;
  }

  /**
   * Whether replacing <player>'s pieces with <change>(pieces) keeps every order on track at
   * the end of the turn (see planEndOfTurn):
   * - <actingPieceId>'s order (if any) is not cancelled (see cancelsOrder), and every panel
   *   it takes up at the end of the turn stays within <maxPieces>;
   * - no other piece whose order was being carried out has it cancelled by the change.
   *
   * @param before - The plan of the current pieces, when the caller already has it.
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

  /**
   * Compare two pieces by order sequence (see Piece.orderSequence): lower numbers first,
   * pieces without one after those with one, ties broken by lower ID.
   */
  static compareOrderSequence(a: Piece, b: Piece): number {
    const aSeq = a.orderSequence ?? Number.POSITIVE_INFINITY;
    const bSeq = b.orderSequence ?? Number.POSITIVE_INFINITY;
    if (aSeq !== bSeq) return aSeq < bSeq ? -1 : 1;
    return a.id - b.id;
  }

  /**
   * Stack count of <pieces> after merging: every mergeable type counts once, every
   * non-mergeable piece counts on its own.
   */
  static mergedStackCount(pieces: Piece[]): number {
    const mergeableTypes = new Set<string>();
    let count = 0;
    for (const piece of pieces) {
      if (piece.pieceType.config.mergeable) {
        mergeableTypes.add(String(piece.pieceType));
      } else {
        count += 1;
      }
    }
    return count + mergeableTypes.size;
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
   * Whether an order for <piece> to <target> reaches no farther than this turn can take it:
   * the shortest path is at most as many panels as the piece's movement points let it advance
   * this turn. For a piece that takes multiple turns per hop, its own panel and the adjacent
   * panels. A piece in transit has no such targets: its move this turn is
   * fixed, and a new order only changes the turns after it.
   */
  static isWithinThisTurnsReach(piece: Piece, target: PanelPosition): boolean {
    if (piece.isInTransit) return false;
    const path = PanelsService.findShortestPath(piece.panelPosition, target);
    if (!path) return false;
    const reach = piece.takesMultipleTurnsPerHop
      ? 1
      : Math.floor(piece.movementPoints / MOVEMENT_HOP_COST);
    return path.length - 1 <= reach;
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
   * Whether <piece> may attack the enemy panel <position>: it can attack at all, and it can
   * defeat every defending piece there (see canDefeatAllDefenders).
   */
  static canAttackPanel(piece: Piece, position: PanelPosition): boolean {
    if (!piece.canAttack) return false;
    const defenders = PiecesRepository.getPiecesByPosition(position).filter(
      (p) => p.player !== piece.player && p.player !== Player.UNKNOWN,
    );
    return this.canDefeatAllDefenders(piece, defenders);
  }

  /**
   * Determine whether <player>'s piece (id = selectedPieceId) can be ordered to <targetPosition>.
   *
   * - A piece whose order is locked (see isOrderLocked) cannot be given a new one.
   * - A target beyond this turn's reach (see isWithinThisTurnsReach) can always be ordered:
   *   what happens this turn — moving on, being blocked, attacking an enemy in the way — is
   *   left to the end-of-turn plan, and nothing is checked at the target.
   * - A target within reach must be carried out this turn: in the end-of-turn plan with the
   *   order (see planEndOfTurn), the piece enters it, attacks it (an enemy panel the piece
   *   can attack), or starts moving into it, and the order cancels no other piece's order
   *   that was being carried out (see keepsOrdersOnTrack).
   *
   * @param before - The plan of <player>'s pieces on the board, when the caller already has
   *   it (see planEndOfTurn), so checking several targets plans the current board only once.
   */
  static canMoveTo(
    targetPosition: PanelPosition,
    player: Player,
    selectedPieceId: number,
    maxPieces: number = DEFAULT_MAX_PIECES_PER_PANEL,
    before?: EndOfTurnPlan,
  ): boolean {
    const piece = PiecesRepository.getAll().find((candidate) => candidate.id === selectedPieceId);
    if (!piece) return false;
    if (this.isOrderLocked(piece)) return false;
    if (!this.isWithinThisTurnsReach(piece, targetPosition)) return true;

    const ordered = this.withOrder(piece, targetPosition);
    return this.keepsOrdersOnTrack(
      player,
      maxPieces,
      (pieces) => pieces.map((candidate) => (candidate.id === piece.id ? ordered : candidate)),
      piece.id,
      before,
    );
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
   * - Otherwise the piece stays on its current panel, which must stay within capacity and
   *   cancel no other piece's order that was being carried out (see keepsOrdersOnTrack).
   */
  static canCancelMove(
    player: Player,
    pieceId: number,
    maxPieces: number = DEFAULT_MAX_PIECES_PER_PANEL,
  ): boolean {
    const piece = PiecesRepository.getAll().find((candidate) => candidate.id === pieceId);
    if (!piece) return false;
    if (this.isOrderLocked(piece)) return false;
    if (piece.transitPosition) {
      return !piece.targetPosition?.equals(piece.transitPosition);
    }

    return this.keepsOrdersOnTrack(
      player,
      maxPieces,
      (pieces) =>
        pieces.map((candidate) =>
          candidate.id === pieceId
            ? new Piece({ ...candidate, targetPosition: undefined })
            : candidate,
        ),
      pieceId,
    );
  }

  /**
   * Whether <newPiece> (not on the board yet) can be added to its panel, staying there: the
   * panel stays within <maxPieces> at the end of the turn with it, and it cancels no piece's
   * order that was being carried out (see keepsOrdersOnTrack).
   *
   * @param before - The plan of the pieces on the board, when the caller already has it
   *   (see planEndOfTurn), so checking several panels plans the current board only once.
   */
  static canPlaceNewPiece(newPiece: Piece, maxPieces: number, before?: EndOfTurnPlan): boolean {
    return this.keepsOrdersOnTrack(
      newPiece.player,
      maxPieces,
      (pieces) => [...pieces, newPiece],
      newPiece.id,
      before,
    );
  }
}
