import { HOME_BASE_INIT_CASTLE, HOME_BASE_INIT_RESOURCE } from "#lib/domain/config.ts";
import {
  createPanel,
  isAdjacent,
  PanelState,
  Player,
  pos,
  posKey,
  samePos,
  type Panel,
  type PanelPosition,
} from "#lib/domain/model.ts";
import { PanelRepository, PiecesRepository } from "#lib/store.svelte.ts";

/** Board adjacency with memoized route queries, rebuilt when the board layout changes. */
class BoardGraph {
  readonly adjacency = new Map<string, PanelPosition[]>();
  readonly distances = new Map<string, Map<string, number>>();
  readonly shortestPaths = new Map<string, PanelPosition[] | null>();
  readonly routePrefixes = new Map<string, PanelPosition[][]>();

  constructor(
    readonly layoutVersion: number,
    positions: PanelPosition[],
  ) {
    for (const position of positions) {
      this.adjacency.set(
        posKey(position),
        positions.filter((other) => isAdjacent(other, position)),
      );
    }
  }

  neighbors(position: PanelPosition): PanelPosition[] {
    return this.adjacency.get(posKey(position)) ?? [];
  }
}

export class PanelsService {
  private static cachedBoardGraph: BoardGraph | undefined;

  static initialize(layer: number): Panel[] {
    const panels: Panel[] = [];
    for (let hl = -(layer - 1); hl <= layer - 1; hl++) {
      for (let vl = 0; vl < layer - Math.abs(hl); vl++) {
        const isHomeBase = Math.abs(hl) === layer - 1 && vl === 0;
        panels.push(
          createPanel({
            panelPosition: pos(hl, vl),
            player: !isHomeBase ? Player.UNKNOWN : hl === 1 - layer ? Player.SELF : Player.OPPONENT,
            resource: isHomeBase ? HOME_BASE_INIT_RESOURCE : 0,
            castle: isHomeBase ? HOME_BASE_INIT_CASTLE : 0,
          }),
        );
      }
    }
    return panels;
  }

  private static boardGraph(): BoardGraph {
    const layoutVersion = PanelRepository.getLayoutVersion();
    if (this.cachedBoardGraph?.layoutVersion !== layoutVersion) {
      this.cachedBoardGraph = new BoardGraph(
        layoutVersion,
        PanelRepository.getAll().map((panel) => panel.panelPosition),
      );
    }
    return this.cachedBoardGraph;
  }

  /** BFS path including both ends, or null if unreachable. */
  static findShortestPath(
    origin: PanelPosition,
    destination: PanelPosition,
  ): PanelPosition[] | null {
    if (samePos(origin, destination)) return [origin];

    const graph = this.boardGraph();
    const cacheKey = `${posKey(origin)}>${posKey(destination)}`;
    if (graph.shortestPaths.has(cacheKey)) {
      const cached = graph.shortestPaths.get(cacheKey)!;
      return cached ? [...cached] : null;
    }

    const cameFrom = new Map<string, PanelPosition>();
    const visited = new Set<string>([posKey(origin)]);
    let frontier = [origin];
    let found: PanelPosition[] | null = null;

    search: while (frontier.length > 0) {
      const nextFrontier: PanelPosition[] = [];
      for (const current of frontier) {
        for (const neighbor of graph.neighbors(current)) {
          const neighborKey = posKey(neighbor);
          if (visited.has(neighborKey)) continue;
          cameFrom.set(neighborKey, current);
          if (samePos(neighbor, destination)) {
            const path = [neighbor];
            let step = current;
            while (!samePos(step, origin)) {
              path.unshift(step);
              step = cameFrom.get(posKey(step))!;
            }
            path.unshift(origin);
            found = path;
            break search;
          }
          visited.add(neighborKey);
          nextFrontier.push(neighbor);
        }
      }
      frontier = nextFrontier;
    }

    graph.shortestPaths.set(cacheKey, found);
    return found ? [...found] : null;
  }

  /** Shortest distance from every reachable panel to <destination>, keyed by posKey. */
  static distancesTo(destination: PanelPosition): Map<string, number> {
    const graph = this.boardGraph();
    const cached = graph.distances.get(posKey(destination));
    if (cached) return cached;

    const distances = new Map<string, number>([[posKey(destination), 0]]);
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
    return distances;
  }

  /**
   * The distinct first <length> panels (origin excluded) of every shortest path: the one along
   * findShortestPath first, then the rest in board order. Empty if origin is the destination.
   */
  static shortestRoutePrefixes(
    origin: PanelPosition,
    destination: PanelPosition,
    length: number,
  ): PanelPosition[][] {
    const graph = this.boardGraph();
    const cacheKey = `${posKey(origin)}>${posKey(destination)}:${length}`;
    const cached = graph.routePrefixes.get(cacheKey);
    if (cached) return cached;

    const distances = this.distancesTo(destination);
    const total = distances.get(posKey(origin));
    const prefixes: PanelPosition[][] = [];

    if (total !== undefined && total > 0 && length > 0) {
      const depth = Math.min(length, total);
      const walk = (current: PanelPosition, prefix: PanelPosition[]) => {
        if (prefix.length === depth) {
          prefixes.push(prefix);
          return;
        }
        const remaining = total - prefix.length - 1;
        for (const neighbor of graph.neighbors(current)) {
          if (distances.get(posKey(neighbor)) === remaining) walk(neighbor, [...prefix, neighbor]);
        }
      };
      walk(origin, []);

      const preferred = this.findShortestPath(origin, destination)?.slice(1, depth + 1);
      const preferredIndex = preferred
        ? prefixes.findIndex((prefix) => prefix.every((p, i) => samePos(p, preferred[i])))
        : -1;
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
