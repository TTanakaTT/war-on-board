import { Panel } from "$lib/domain/entities/Panel";
import { PanelState } from "$lib/domain/enums/PanelState";
import { PanelPosition } from "$lib/domain/entities/PanelPosition";
import { PanelRepository } from "$lib/data/repositories/PanelRepository";
import { PiecesRepository } from "$lib/data/repositories/PieceRepository";
import { Player } from "$lib/domain/enums/Player";
import {
  HOME_BASE_INIT_RESOURCE,
  HOME_BASE_INIT_CASTLE,
} from "$lib/domain/constants/GameConstants";

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
    const key = (p: PanelPosition) => `${p.horizontalLayer},${p.verticalLayer}`;
    if (origin.equals(destination)) return [origin];

    const cameFrom = new Map<string, PanelPosition>();
    const visited = new Set<string>([key(origin)]);
    let frontier = [origin];

    while (frontier.length > 0) {
      const nextFrontier: PanelPosition[] = [];

      for (const current of frontier) {
        const neighbors = this.findAdjacentPanels(current).map((p) => p.panelPosition);

        for (const neighbor of neighbors) {
          const neighborKey = key(neighbor);
          if (visited.has(neighborKey)) continue;

          cameFrom.set(neighborKey, current);
          if (neighbor.equals(destination)) {
            const path = [neighbor];
            let step = current;
            while (!step.equals(origin)) {
              path.unshift(step);
              step = cameFrom.get(key(step))!;
            }
            path.unshift(origin);
            return path;
          }

          visited.add(neighborKey);
          nextFrontier.push(neighbor);
        }
      }

      frontier = nextFrontier;
    }

    return null;
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
