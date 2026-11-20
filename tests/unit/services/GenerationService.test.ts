import { beforeEach, describe, expect, test } from "vitest";
import { GameApi } from "#lib/api/GameApi.ts";
import { RESOURCE_THRESHOLD_FOR_GENERATION } from "#lib/domain/config.ts";
import {
  opponentOf,
  PieceType,
  type GenerationMode,
  type PanelPosition,
} from "#lib/domain/model.ts";
import { GenerationService as G } from "#lib/services/GenerationService.ts";
import { InvariantService } from "#lib/services/InvariantService.ts";
import { PiecesRepository, TurnRepository } from "#lib/store.svelte.ts";
import {
  add,
  fill,
  newGame,
  panel,
  piece,
  pos,
  setPanel,
  setResources,
  setTurn,
  SIDES,
} from "../helpers.ts";

describe.each(SIDES)("GenerationService (%s)", (player) => {
  const enemy = opponentOf(player);
  const side = player === "self" ? -1 : 1;
  const at = (h: number, v: number) => pos(side * h, v);
  const home = at(3, 0);
  const own = (p: PanelPosition, resource = RESOURCE_THRESHOLD_FOR_GENERATION) =>
    setPanel(p, { player, resource });
  const mode = (generationMode: GenerationMode) =>
    setTurn({
      generationMode: { ...TurnRepository.get().generationMode, [player]: generationMode },
    });

  beforeEach(() => {
    newGame(4, player);
    setResources(player, 100);
    mode("rear");
  });

  test("rear prefers the home base, then larger |h|, then lower v", () => {
    own(at(1, 0));
    own(at(2, 1));
    own(at(2, 0));
    expect(G.findGenerationPanel(player)).toEqual(home);
    fill(home, 10, player);
    expect(G.findGenerationPanel(player)).toEqual(at(2, 0));
  });

  test("front prefers panels closest to the enemy home base, even on its side", () => {
    mode("front");
    own(at(1, 0));
    own(at(-1, 1));
    own(at(-1, 0));
    expect(G.findGenerationPanel(player)).toEqual(at(-1, 0));
  });

  test("needs an owned panel with enough resource", () => {
    setPanel(home, { resource: RESOURCE_THRESHOLD_FOR_GENERATION - 1 });
    own(at(2, 0));
    setPanel(at(2, 0), { player: enemy });
    expect(G.findGenerationPanel(player)).toBeNull();
  });

  test("a full panel only takes a mergeable type matching a resident not in transit", () => {
    add(1, home, player, { pieceType: PieceType.HEAVY });
    add(2, home, player, { pieceType: PieceType.ROOK });
    expect(G.findGenerationPanel(player, PieceType.HEAVY)).toEqual(home);
    expect(G.findGenerationPanel(player, PieceType.INFANTRY)).toBeNull();
    expect(G.findGenerationPanel(player, PieceType.ROOK)).toBeNull();
    PiecesRepository.update({
      ...piece(1),
      targetPosition: at(2, 0),
      transitPosition: at(2, 0),
      hopProgress: 0.25,
    });
    expect(G.findGenerationPanel(player, PieceType.HEAVY)).toBeNull();
  });

  test("counts pieces moving in and refuses panels that are full right now", () => {
    own(at(2, 0));
    own(at(2, 1), 0);
    add(1, at(2, 1), player, { pieceType: PieceType.ROOK, targetPosition: home });
    add(2, at(2, 1), player, { pieceType: PieceType.NOBLE, targetPosition: home });
    expect(G.findGenerationPanel(player, PieceType.ROOK)).toEqual(at(2, 0));
    fill(at(2, 0), 10, player);
    PiecesRepository.update({ ...piece(10), targetPosition: at(1, 0) });
    expect(G.findGenerationPanel(player, PieceType.ROOK)).toBeNull();
  });

  test("a heavy about to leave still takes its panel this turn", () => {
    add(1, home, player, {
      pieceType: PieceType.HEAVY,
      targetPosition: at(2, 0),
      movementPoints: 0,
    });
    add(2, at(2, 1), player, { pieceType: PieceType.ROOK, targetPosition: home });
    expect(G.findGenerationPanel(player, PieceType.CAVALRY)).toBeNull();
  });

  test("an incoming same type lets a projected-full panel take it, within capacity after endTurn", () => {
    add(1, home, player, { pieceType: PieceType.ROOK });
    add(2, at(2, 1), player);
    GameApi.assignMove(player, 2, home);
    expect(G.findGenerationPanel(player, PieceType.ROOK)).toBeNull();
    expect(GameApi.generatePiece(player, PieceType.INFANTRY).ok).toBe(true);
    GameApi.endTurn(player);
    expect(InvariantService.check(GameApi.getGameState())).toEqual([]);
  });

  test("generate spends the cost and keeps the panel's values", () => {
    setPanel(home, { wall: 3 });
    expect(G.generate(PieceType.ARCHER, home)).toEqual(home);
    expect(PiecesRepository.getAll()[0]).toMatchObject({ pieceType: PieceType.ARCHER, player });
    expect(panel(home)).toMatchObject({ wall: 3, resource: 5, panelState: "occupied" });
    setResources(player, 0);
    expect(G.generate()).toBeNull();
  });
});
