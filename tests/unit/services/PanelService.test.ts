import { beforeEach, describe, expect, test } from "vitest";
import { GameApi } from "#lib/api/GameApi.ts";
import {
  isAdjacent,
  PanelState,
  PieceType,
  Player,
  Terrain,
  type PanelPosition,
} from "#lib/domain/model.ts";
import { PanelsService as P } from "#lib/services/PanelService.ts";
import { PanelRepository } from "#lib/store.svelte.ts";
import { add, newGame, panel, pos, setPanel } from "../helpers.ts";

const INFANTRY = PieceType.INFANTRY;
const at = (horizontalLayer: number, verticalLayer: number, terrain: Terrain) => ({
  horizontalLayer,
  verticalLayer,
  terrain,
});
const viaCenter = [pos(-1, 0), pos(0, 0), pos(1, 0)];
const aroundCenter = [pos(-1, 0), pos(0, 1), pos(1, 0)];

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
    expect(P.findShortestPath(pos(0, 0), pos(0, 0), INFANTRY)).toEqual([pos(0, 0)]);
    const path = P.findShortestPath(pos(-3, 0), pos(3, 0), INFANTRY)!;
    expect(path).toHaveLength(7);
    path.slice(1).forEach((p, i) => expect(isAdjacent(p, path[i])).toBe(true));
    expect(P.routeCostsTo(pos(0, 0), INFANTRY).get("-3,0")).toBe(3);
    expect(P.distance(pos(-3, 0), pos(0, 0))).toBe(3);
  });

  test("route prefixes: findShortestPath's route first, distinct, within the budget", () => {
    expect(P.shortestRoutePrefixes(pos(-2, 0), pos(2, 0), INFANTRY, 2)).toEqual([
      [pos(-1, 0), pos(0, 0)],
      [pos(-1, 0), pos(0, 1)],
      [pos(-1, 1), pos(0, 1)],
      [pos(-1, 1), pos(0, 2)],
    ]);
    expect(P.shortestRoutePrefixes(pos(-1, 0), pos(1, 0), INFANTRY, 5)).toEqual([
      [pos(0, 0), pos(1, 0)],
      [pos(0, 1), pos(1, 0)],
    ]);
    expect(P.shortestRoutePrefixes(pos(0, 0), pos(0, 0), INFANTRY, 2)).toEqual([]);
    expect(P.shortestRoutePrefixes(pos(-1, 0), pos(1, 0), INFANTRY, 0)).toEqual([
      [pos(0, 0)],
      [pos(0, 1)],
    ]);
  });

  test("route caches follow board layout changes", () => {
    expect(P.routeCostsTo(pos(0, 0), INFANTRY).size).toBe(16);
    GameApi.initializeGame({ layer: 3 });
    expect(P.routeCostsTo(pos(0, 0), INFANTRY).size).toBe(9);
    expect(P.findShortestPath(pos(-3, 0), pos(0, 0), INFANTRY)).toBeNull();
  });

  test("route caches are rebuilt when only the terrain changes", () => {
    expect(P.findShortestPath(pos(-1, 0), pos(1, 0), INFANTRY)).toEqual(viaCenter);
    GameApi.initializeGame({ layer: 4, terrains: [at(0, 0, Terrain.MOUNTAIN)] });
    expect(P.findShortestPath(pos(-1, 0), pos(1, 0), INFANTRY)).toEqual(aroundCenter);
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

describe("terrain", () => {
  test("initialize mirrors the given terrains to the other half", () => {
    const panels = P.initialize(4, [at(1, 0, Terrain.HILL), at(0, 2, Terrain.FOREST)]);
    const special = panels
      .filter((p) => p.terrain !== Terrain.PLAIN)
      .map((p) => [p.panelPosition, p.terrain]);
    expect(special).toEqual([
      [pos(-1, 0), Terrain.HILL],
      [pos(0, 2), Terrain.FOREST],
      [pos(1, 0), Terrain.HILL],
    ]);
  });

  test("routes take the cheapest way around a hill", () => {
    newGame(4, Player.SELF, [at(0, 0, Terrain.HILL)]);
    expect(P.findShortestPath(pos(-1, 0), pos(1, 0), INFANTRY)).toEqual(aroundCenter);
    expect(P.routeCostsTo(pos(1, 0), INFANTRY).get("-1,0")).toBe(2);
  });

  test("a step between hills and forests adds the extra cost once", () => {
    newGame(4, Player.SELF, [at(0, 0, Terrain.HILL), at(0, 1, Terrain.FOREST)]);
    expect(P.hopCost(INFANTRY, pos(0, 0), pos(0, 1))).toBe(2);
    expect(P.hopCost(INFANTRY, pos(0, 1), pos(0, 0))).toBe(2);
  });

  test("distance counts mountains while routes never cross them", () => {
    newGame(4, Player.SELF, [at(0, 0, Terrain.MOUNTAIN)]);
    expect(P.distance(pos(-1, 0), pos(1, 0))).toBe(2);
    expect(P.findShortestPath(pos(-1, 0), pos(1, 0), INFANTRY)).toEqual(aroundCenter);
    expect(P.findShortestPath(pos(-1, 0), pos(0, 0), INFANTRY)).toBeNull();
  });
});
