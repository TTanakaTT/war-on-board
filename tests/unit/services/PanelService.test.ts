import { beforeEach, describe, expect, test } from "vitest";
import { GameApi } from "#lib/api/GameApi.ts";
import { isAdjacent, PanelState, Player, type PanelPosition } from "#lib/domain/model.ts";
import { PanelsService as P } from "#lib/services/PanelService.ts";
import { PanelRepository } from "#lib/store.svelte.ts";
import { add, newGame, panel, pos, setPanel } from "../helpers.ts";

beforeEach(() => newGame(4));

describe("board", () => {
  test("adjacency is symmetric and edge panels have fewer neighbors", () => {
    const positions = PanelRepository.getAll().map((p) => p.panelPosition);
    const neighbors = (p: PanelPosition) => positions.filter((q) => isAdjacent(p, q));
    expect(neighbors(pos(0, 1))).toHaveLength(6);
    expect(neighbors(pos(-3, 0))).toEqual([pos(-2, 0), pos(-2, 1)]);
    for (const p of positions) for (const q of neighbors(p)) expect(isAdjacent(q, p)).toBe(true);
  });

  test("shortest paths and distances", () => {
    expect(P.findShortestPath(pos(0, 0), pos(0, 0))).toEqual([pos(0, 0)]);
    const path = P.findShortestPath(pos(-3, 0), pos(3, 0))!;
    expect(path).toHaveLength(7);
    path.slice(1).forEach((p, i) => expect(isAdjacent(p, path[i])).toBe(true));
    expect(P.distancesTo(pos(0, 0)).get("-3,0")).toBe(3);
  });

  test("route prefixes: findShortestPath's route first, distinct, capped at the route length", () => {
    expect(P.shortestRoutePrefixes(pos(-2, 0), pos(2, 0), 2)).toEqual([
      [pos(-1, 0), pos(0, 0)],
      [pos(-1, 0), pos(0, 1)],
      [pos(-1, 1), pos(0, 1)],
      [pos(-1, 1), pos(0, 2)],
    ]);
    expect(P.shortestRoutePrefixes(pos(-1, 0), pos(1, 0), 5)).toEqual([
      [pos(0, 0), pos(1, 0)],
      [pos(0, 1), pos(1, 0)],
    ]);
    expect(P.shortestRoutePrefixes(pos(0, 0), pos(0, 0), 2)).toEqual([]);
    expect(P.shortestRoutePrefixes(pos(-1, 0), pos(1, 0), 0)).toEqual([]);
  });

  test("route caches follow board layout changes", () => {
    expect(P.distancesTo(pos(0, 0)).size).toBe(16);
    GameApi.initializeGame({ layer: 3 });
    expect(P.distancesTo(pos(0, 0)).size).toBe(9);
    expect(P.findShortestPath(pos(-3, 0), pos(0, 0))).toBeNull();
  });

  test("clearSelected resets highlights from occupancy; refresh also sets owners", () => {
    add(1, pos(0, 0), Player.OPPONENT);
    setPanel(pos(0, 0), { panelState: PanelState.SELECTED, resource: 2 });
    setPanel(pos(0, 1), { panelState: PanelState.MOVABLE });
    const cleared = P.clearSelected();
    expect(
      cleared.find(
        (p) => p.panelPosition.verticalLayer === 1 && p.panelPosition.horizontalLayer === 0,
      )!.panelState,
    ).toBe(PanelState.UNOCCUPIED);
    PanelRepository.setAll(cleared);
    expect(panel(pos(0, 0)).panelState).toBe(PanelState.OCCUPIED);
    P.refreshPanelStates();
    expect(panel(pos(0, 0))).toMatchObject({ player: Player.OPPONENT, resource: 2 });
  });
});
