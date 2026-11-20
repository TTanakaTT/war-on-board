import {
  HOME_BASE_INIT_RESOURCE,
  HOME_BASE_INIT_WALL,
  type GameMapConfig,
} from "#lib/domain/config.ts";
import {
  createPanel,
  hopCost,
  isAdjacent,
  PanelState,
  Player,
  pos,
  posKey,
  samePos,
  Terrain,
  terrainConfig,
  type Panel,
  type PanelPosition,
  type PieceType,
} from "#lib/domain/model.ts";
import { PanelRepository, PiecesRepository } from "#lib/store.svelte.ts";

/** Movement costs are multiples of half a point; this absorbs float noise when comparing sums. */
const COST_EPSILON = 1e-9;

/** Board adjacency with memoized route queries, rebuilt when the board layout changes. */
class BoardGraph {
  readonly terrains = new Map<string, Terrain>();
  /** Every panel, terrain ignored (ranged distance). */
  readonly adjacency = new Map<string, PanelPosition[]>();
  /** Passable panels only (movement). */
  readonly passableAdjacency = new Map<string, PanelPosition[]>();
  readonly distances = new Map<string, Map<string, number>>();
  readonly routeCosts = new Map<string, Map<string, number>>();
  readonly shortestPaths = new Map<string, PanelPosition[] | null>();
  readonly routePrefixes = new Map<string, PanelPosition[][]>();

  constructor(
    readonly layoutVersion: number,
    panels: Panel[],
  ) {
    for (const panel of panels) this.terrains.set(posKey(panel.panelPosition), panel.terrain);
    const positions = panels.map((panel) => panel.panelPosition);
    const passable = positions.filter((position) => this.isPassable(position));
    for (const position of positions) {
      this.adjacency.set(
        posKey(position),
        positions.filter((other) => isAdjacent(other, position)),
      );
    }
    for (const position of passable) {
      this.passableAdjacency.set(
        posKey(position),
        passable.filter((other) => isAdjacent(other, position)),
      );
    }
  }

  terrain(position: PanelPosition): Terrain {
    return this.terrains.get(posKey(position)) ?? Terrain.PLAIN;
  }

  isPassable(position: PanelPosition): boolean {
    return this.terrains.has(posKey(position)) && terrainConfig(this.terrain(position)).passable;
  }

  neighbors(position: PanelPosition): PanelPosition[] {
    return this.adjacency.get(posKey(position)) ?? [];
  }

  passableNeighbors(position: PanelPosition): PanelPosition[] {
    return this.passableAdjacency.get(posKey(position)) ?? [];
  }

  hopCost(pieceType: PieceType, position: PanelPosition): number {
    return hopCost(pieceType, this.terrain(position));
  }
}

export class PanelsService {
  private static cachedBoardGraph: BoardGraph | undefined;

  /** <terrains> are mirrored to the other half, so the board stays symmetric. */
  static initialize(layer: number, terrains: GameMapConfig["terrains"] = []): Panel[] {
    const terrainAt = new Map<string, Terrain>();
    for (const { horizontalLayer, verticalLayer, terrain } of terrains) {
      terrainAt.set(posKey(pos(horizontalLayer, verticalLayer)), terrain);
      terrainAt.set(posKey(pos(-horizontalLayer, verticalLayer)), terrain);
    }
    const panels: Panel[] = [];
    for (let hl = -(layer - 1); hl <= layer - 1; hl++) {
      for (let vl = 0; vl < layer - Math.abs(hl); vl++) {
        const isHomeBase = Math.abs(hl) === layer - 1 && vl === 0;
        panels.push(
          createPanel({
            panelPosition: pos(hl, vl),
            player: !isHomeBase ? Player.UNKNOWN : hl === 1 - layer ? Player.SELF : Player.OPPONENT,
            resource: isHomeBase ? HOME_BASE_INIT_RESOURCE : 0,
            wall: isHomeBase ? HOME_BASE_INIT_WALL : 0,
            terrain: terrainAt.get(posKey(pos(hl, vl))) ?? Terrain.PLAIN,
          }),
        );
      }
    }
    return panels;
  }

  private static boardGraph(): BoardGraph {
    const layoutVersion = PanelRepository.getLayoutVersion();
    if (this.cachedBoardGraph?.layoutVersion !== layoutVersion) {
      this.cachedBoardGraph = new BoardGraph(layoutVersion, PanelRepository.getAll());
    }
    return this.cachedBoardGraph;
  }

  static terrainAt(position: PanelPosition): Terrain {
    return this.boardGraph().terrain(position);
  }

  static isPassable(position: PanelPosition): boolean {
    return this.boardGraph().isPassable(position);
  }

  /** Movement points <pieceType> spends to enter (or attack) <position>. */
  static hopCostTo(pieceType: PieceType, position: PanelPosition): number {
    return this.boardGraph().hopCost(pieceType, position);
  }

  /** Panels apart with terrain ignored (mountains included), or Infinity. */
  static distance(origin: PanelPosition, destination: PanelPosition): number {
    const graph = this.boardGraph();
    let distances = graph.distances.get(posKey(destination));
    if (!distances) {
      distances = new Map([[posKey(destination), 0]]);
      let frontier = [destination];
      while (frontier.length > 0) {
        const nextFrontier: PanelPosition[] = [];
        for (const current of frontier) {
          const distance = distances.get(posKey(current))! + 1;
          for (const neighbor of graph.neighbors(current)) {
            if (distances.has(posKey(neighbor))) continue;
            distances.set(posKey(neighbor), distance);
            nextFrontier.push(neighbor);
          }
        }
        frontier = nextFrontier;
      }
      graph.distances.set(posKey(destination), distances);
    }
    return distances.get(posKey(origin)) ?? Number.POSITIVE_INFINITY;
  }

  /**
   * Cheapest route for <pieceType> over passable panels, including both ends, or null.
   * Equal costs keep the earliest-found route (breadth-first order on a uniform board).
   */
  static findShortestPath(
    origin: PanelPosition,
    destination: PanelPosition,
    pieceType: PieceType,
  ): PanelPosition[] | null {
    if (samePos(origin, destination)) return [origin];

    const graph = this.boardGraph();
    const cacheKey = `${pieceType}:${posKey(origin)}>${posKey(destination)}`;
    if (graph.shortestPaths.has(cacheKey)) {
      const cached = graph.shortestPaths.get(cacheKey)!;
      return cached ? [...cached] : null;
    }

    const cameFrom = new Map<string, PanelPosition>();
    const costs = new Map<string, number>([[posKey(origin), 0]]);
    const settled = new Set<string>();
    let open: { position: PanelPosition; cost: number }[] = [{ position: origin, cost: 0 }];
    let found: PanelPosition[] | null = null;

    while (open.length > 0) {
      // Lowest cost first; ties in insertion order.
      const index = open.reduce((best, entry, i) => (entry.cost < open[best].cost ? i : best), 0);
      const { position: current, cost } = open[index];
      open = open.filter((_, i) => i !== index);
      if (settled.has(posKey(current))) continue;
      settled.add(posKey(current));

      if (samePos(current, destination)) {
        const path = [current];
        while (!samePos(path[0], origin)) path.unshift(cameFrom.get(posKey(path[0]))!);
        found = path;
        break;
      }
      for (const neighbor of graph.passableNeighbors(current)) {
        const key = posKey(neighbor);
        const next = cost + graph.hopCost(pieceType, neighbor);
        if (settled.has(key) || next >= (costs.get(key) ?? Number.POSITIVE_INFINITY)) continue;
        costs.set(key, next);
        cameFrom.set(key, current);
        open.push({ position: neighbor, cost: next });
      }
    }

    graph.shortestPaths.set(cacheKey, found);
    return found ? [...found] : null;
  }

  /** Cheapest cost for <pieceType> from every panel that can reach <destination>, keyed by posKey. */
  static routeCostsTo(destination: PanelPosition, pieceType: PieceType): Map<string, number> {
    const graph = this.boardGraph();
    const cacheKey = `${pieceType}:${posKey(destination)}`;
    const cached = graph.routeCosts.get(cacheKey);
    if (cached) return cached;

    const costs = new Map<string, number>([[posKey(destination), 0]]);
    const settled = new Set<string>();
    let open: { position: PanelPosition; cost: number }[] = [{ position: destination, cost: 0 }];
    while (open.length > 0) {
      const index = open.reduce((best, entry, i) => (entry.cost < open[best].cost ? i : best), 0);
      const { position: current, cost } = open[index];
      open = open.filter((_, i) => i !== index);
      if (settled.has(posKey(current))) continue;
      settled.add(posKey(current));

      // Stepping from a neighbor into <current> costs <current>'s terrain.
      const next = cost + graph.hopCost(pieceType, current);
      for (const neighbor of graph.passableNeighbors(current)) {
        const key = posKey(neighbor);
        if (settled.has(key) || next >= (costs.get(key) ?? Number.POSITIVE_INFINITY)) continue;
        costs.set(key, next);
        open.push({ position: neighbor, cost: next });
      }
    }

    graph.routeCosts.set(cacheKey, costs);
    return costs;
  }

  /**
   * The distinct starts (origin excluded) of every cheapest route for <pieceType>, each
   * extended while its cost stays within <budget>; the first panel is always included.
   * The one along findShortestPath comes first, then the rest in board order. Empty if
   * origin is the destination or cannot reach it.
   */
  static shortestRoutePrefixes(
    origin: PanelPosition,
    destination: PanelPosition,
    pieceType: PieceType,
    budget: number,
  ): PanelPosition[][] {
    const graph = this.boardGraph();
    const cacheKey = `${pieceType}:${posKey(origin)}>${posKey(destination)}:${budget}`;
    const cached = graph.routePrefixes.get(cacheKey);
    if (cached) return cached;

    const costs = this.routeCostsTo(destination, pieceType);
    const total = costs.get(posKey(origin));
    const prefixes: PanelPosition[][] = [];
    const fits = (prefix: PanelPosition[], spent: number, cost: number) =>
      prefix.length === 0 || spent + cost <= budget + COST_EPSILON;

    if (total !== undefined && total > 0) {
      const walk = (current: PanelPosition, prefix: PanelPosition[], spent: number) => {
        if (samePos(current, destination)) {
          prefixes.push(prefix);
          return;
        }
        const remaining = costs.get(posKey(current))!;
        let endsHere = false;
        for (const neighbor of graph.passableNeighbors(current)) {
          const cost = graph.hopCost(pieceType, neighbor);
          const rest = costs.get(posKey(neighbor));
          if (rest === undefined || Math.abs(rest + cost - remaining) > COST_EPSILON) continue;
          if (fits(prefix, spent, cost)) walk(neighbor, [...prefix, neighbor], spent + cost);
          else endsHere = true;
        }
        if (endsHere) prefixes.push(prefix);
      };
      walk(origin, [], 0);

      const preferred: PanelPosition[] = [];
      let spent = 0;
      for (const position of this.findShortestPath(origin, destination, pieceType)?.slice(1) ??
        []) {
        const cost = graph.hopCost(pieceType, position);
        if (!fits(preferred, spent, cost)) break;
        preferred.push(position);
        spent += cost;
      }
      const preferredIndex = prefixes.findIndex(
        (prefix) =>
          prefix.length === preferred.length && prefix.every((p, i) => samePos(p, preferred[i])),
      );
      if (preferredIndex > 0) prefixes.unshift(...prefixes.splice(preferredIndex, 1));
    }

    graph.routePrefixes.set(cacheKey, prefixes);
    return prefixes;
  }

  /** Panels with UI highlights reset to occupied/unoccupied. */
  static clearSelected(): Panel[] {
    return PanelRepository.getAll().map((p) =>
      p.panelState === PanelState.MOVABLE || p.panelState === PanelState.SELECTED
        ? { ...p, panelState: this.occupancyState(p.panelPosition) }
        : p,
    );
  }

  /** Resets panel states from occupancy; an occupied panel belongs to its pieces' player. */
  static refreshPanelStates(): void {
    PanelRepository.setAll(
      PanelRepository.getAll().map((p) => {
        const pieces = PiecesRepository.getPiecesByPosition(p.panelPosition);
        return {
          ...p,
          panelState: pieces.length > 0 ? PanelState.OCCUPIED : PanelState.UNOCCUPIED,
          player: pieces.length > 0 ? pieces[0].player : p.player,
        };
      }),
    );
  }

  private static occupancyState(position: PanelPosition): PanelState {
    return PiecesRepository.getPiecesByPosition(position).length > 0
      ? PanelState.OCCUPIED
      : PanelState.UNOCCUPIED;
  }
}
