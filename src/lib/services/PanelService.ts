import { Panel } from "#lib/domain/entities/Panel.ts";
import { PanelState } from "#lib/domain/enums/PanelState.ts";
import { PanelPosition } from "#lib/domain/entities/PanelPosition.ts";
import { PanelRepository } from "#lib/data/repositories/PanelRepository.ts";
import { PiecesRepository } from "#lib/data/repositories/PieceRepository.ts";
import { Player } from "#lib/domain/enums/Player.ts";
import {
  HOME_BASE_INIT_RESOURCE,
  HOME_BASE_INIT_CASTLE,
} from "#lib/domain/constants/GameConstants.ts";

function positionKey(position: PanelPosition): string {
  return `${position.horizontalLayer},${position.verticalLayer}`;
}

/**
 * Adjacency between the board's panels, with the route queries built on it memoized. Panel
 * positions never change during a game, so one graph serves every query until the board's
 * layout changes (see PanelRepository.getLayoutVersion).
 */
class BoardGraph {
  readonly adjacency = new Map<string, PanelPosition[]>();
  readonly distances = new Map<string, Map<string, number>>();
  readonly shortestPaths = new Map<string, PanelPosition[] | null>();
  readonly routePrefixes = new Map<string, PanelPosition[][]>();

  constructor(
    readonly layoutVersion: number,
    positions: PanelPosition[],
  ) {
    // Neighbors keep board order, as PanelsService.findAdjacentPanels returns them.
    for (const position of positions) {
      this.adjacency.set(
        positionKey(position),
        positions.filter((other) => other.isAdjacent(position)),
      );
    }
  }

  neighbors(position: PanelPosition): PanelPosition[] {
    return this.adjacency.get(positionKey(position)) ?? [];
  }
}

export class PanelsService {
  static initialize(layer: number): Panel[] {
    const panels: Panel[] = [];
    for (let hl = -(layer - 1); hl <= layer - 1; hl++) {
      for (let vl = 0; vl < layer - Math.abs(hl); vl++) {
        let initPlayer = Player.UNKNOWN;
        if (hl === -(layer - 1) && vl === 0) {
          initPlayer = Player.SELF;
        } else if (hl === layer - 1 && vl === 0) {
          initPlayer = Player.OPPONENT;
        }
        const isHomeBase = Math.abs(hl) === layer - 1 && vl === 0;
        const initResource = isHomeBase ? HOME_BASE_INIT_RESOURCE : 0;
        const initCastle = isHomeBase ? HOME_BASE_INIT_CASTLE : 0;
        panels.push(
          new Panel({
            panelPosition: new PanelPosition({ horizontalLayer: hl, verticalLayer: vl }),
            panelState: PanelState.UNOCCUPIED,
            player: initPlayer,
            resource: initResource,
            castle: initCastle,
          }),
        );
      }
    }
    return panels;
  }

  static find(panelPosition: PanelPosition): Panel | undefined {
    const panels = PanelRepository.getAll();
    return panels.find((x) => x.panelPosition.equals(panelPosition));
  }

  static findPanelState(panelPosition: PanelPosition): PanelState | undefined {
    const panelState = this.find(panelPosition)?.panelState;
    return panelState;
  }

  static findAdjacentPanels(panelPosition: PanelPosition): Panel[] {
    const panels = PanelRepository.getAll();
    return panels.filter((x) => x.panelPosition.isAdjacent(panelPosition));
  }

  private static cachedBoardGraph: BoardGraph | undefined;

  /** The adjacency graph of the current board, rebuilt only when the board's layout changes. */
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

  /**
   * Shortest path from origin to destination (inclusive of both ends), treating
   * adjacency (`PanelPosition.isAdjacent`) as graph edges — breadth-first, so the
   * result is minimal-length. Returns `[origin]` when origin equals destination,
   * or `null` if destination is unreachable (shouldn't happen on a connected board).
   */
  static findShortestPath(
    origin: PanelPosition,
    destination: PanelPosition,
  ): PanelPosition[] | null {
    if (origin.equals(destination)) return [origin];

    const graph = this.boardGraph();
    const cacheKey = `${positionKey(origin)}>${positionKey(destination)}`;
    if (graph.shortestPaths.has(cacheKey)) {
      const cached = graph.shortestPaths.get(cacheKey)!;
      return cached ? [...cached] : null;
    }

    const cameFrom = new Map<string, PanelPosition>();
    const visited = new Set<string>([positionKey(origin)]);
    let frontier = [origin];
    let found: PanelPosition[] | null = null;

    search: while (frontier.length > 0) {
      const nextFrontier: PanelPosition[] = [];

      for (const current of frontier) {
        for (const neighbor of graph.neighbors(current)) {
          const neighborKey = positionKey(neighbor);
          if (visited.has(neighborKey)) continue;

          cameFrom.set(neighborKey, current);
          if (neighbor.equals(destination)) {
            const path = [neighbor];
            let step = current;
            while (!step.equals(origin)) {
              path.unshift(step);
              step = cameFrom.get(positionKey(step))!;
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

  /**
   * Length of the shortest path from every reachable panel to <destination>, keyed by
   * `"horizontalLayer,verticalLayer"`.
   */
  static distancesTo(destination: PanelPosition): Map<string, number> {
    const graph = this.boardGraph();
    const cached = graph.distances.get(positionKey(destination));
    if (cached) return cached;

    const distances = new Map<string, number>([[positionKey(destination), 0]]);
    let frontier = [destination];
    while (frontier.length > 0) {
      const nextFrontier: PanelPosition[] = [];
      for (const current of frontier) {
        const distance = distances.get(positionKey(current))! + 1;
        for (const neighbor of graph.neighbors(current)) {
          if (distances.has(positionKey(neighbor))) continue;
          distances.set(positionKey(neighbor), distance);
          nextFrontier.push(neighbor);
        }
      }
      frontier = nextFrontier;
    }

    graph.distances.set(positionKey(destination), distances);
    return distances;
  }

  /**
   * The distinct first <length> panels (origin excluded) of every shortest path from <origin>
   * to <destination> — all of them when the path is shorter. The one along findShortestPath
   * comes first, then the others in board order (the order of PanelRepository.getAll()).
   * Empty when origin equals destination or destination is unreachable.
   */
  static shortestRoutePrefixes(
    origin: PanelPosition,
    destination: PanelPosition,
    length: number,
  ): PanelPosition[][] {
    const graph = this.boardGraph();
    const cacheKey = `${positionKey(origin)}>${positionKey(destination)}:${length}`;
    const cached = graph.routePrefixes.get(cacheKey);
    if (cached) return cached;

    const distances = this.distancesTo(destination);
    const total = distances.get(positionKey(origin));
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
          if (distances.get(positionKey(neighbor)) === remaining) {
            walk(neighbor, [...prefix, neighbor]);
          }
        }
      };
      walk(origin, []);

      const preferred = this.findShortestPath(origin, destination)?.slice(1, depth + 1);
      const preferredIndex = preferred
        ? prefixes.findIndex((prefix) =>
            prefix.every((position, i) => position.equals(preferred[i])),
          )
        : -1;
      if (preferredIndex > 0) prefixes.unshift(...prefixes.splice(preferredIndex, 1));
    }

    graph.routePrefixes.set(cacheKey, prefixes);
    return prefixes;
  }

  static clearSelected(): Panel[] {
    const panels = PanelRepository.getAll();
    return panels.map((p) => {
      switch (p.panelState) {
        case PanelState.MOVABLE:
        case PanelState.IMMOVABLE:
        case PanelState.SELECTED: {
          const hasPiece = PiecesRepository.getPiecesByPosition(p.panelPosition).length > 0;

          return new Panel({
            panelPosition: p.panelPosition,
            panelState: hasPiece ? PanelState.OCCUPIED : PanelState.UNOCCUPIED,
            player: p.player,
            resource: p.resource,
            castle: p.castle,
          });
        }
        default:
          return p;
      }
    });
  }

  static refreshPanelStates(): void {
    const panels = PanelRepository.getAll();
    const newPanels = panels.map((p) => {
      const pieces = PiecesRepository.getPiecesByPosition(p.panelPosition);
      const hasPiece = pieces.length > 0;
      return new Panel({
        panelPosition: p.panelPosition,
        panelState: hasPiece ? PanelState.OCCUPIED : PanelState.UNOCCUPIED,
        player: hasPiece ? pieces[0].player : p.player,
        resource: p.resource,
        castle: p.castle,
      });
    });
    PanelRepository.setAll(newPanels);
  }
}
