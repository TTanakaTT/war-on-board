import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GameApi } from "#lib/api/GameApi.ts";
import { GameApiClient } from "#lib/api/GameApiClient.ts";
import { ActionError, AiStrength, Player } from "#lib/domain/model.ts";
import { AiService } from "#lib/services/AiService.ts";
import { createSeededRandom, shuffle } from "#lib/services/ai/random.ts";
import { TurnRepository } from "#lib/store.svelte.ts";

// Smoke tests only: AI choices are not tested in detail.
const rand = () => createSeededRandom(12345);
const turnPlayer = () => TurnRepository.get().player;

beforeEach(() => GameApi.initializeGame({ layer: 4 }));
afterEach(() => vi.restoreAllMocks());

describe("seeded random", () => {
  test("is reproducible, in [0, 1), and shuffle copies", () => {
    const take = (seed: number) => Array.from({ length: 50 }, createSeededRandom(seed));
    expect(take(1)).toEqual(take(1));
    expect(take(1)).not.toEqual(take(2));
    expect(take(3).every((v) => v >= 0 && v < 1)).toBe(true);
    const items = [1, 2, 3, 4, 5];
    expect([...shuffle(items, rand())].sort()).toEqual(items);
    expect(shuffle(items, rand())).toEqual(shuffle(items, rand()));
  });
});

describe.each(Object.values(AiStrength))("AiService %s", (strength) => {
  test("plays either side, also from a restored state, and is reproducible", () => {
    AiService.doAiTurn(Player.OPPONENT, strength, rand());
    expect(turnPlayer()).toBe(Player.SELF);
    AiService.doAiTurn(Player.SELF, strength, rand());
    AiService.doAiTurn(Player.OPPONENT, strength, rand());
    expect(turnPlayer()).toBe(Player.SELF);

    const play = () => {
      GameApi.initializeGame({ layer: 4 });
      const randoms = { self: createSeededRandom(1), opponent: createSeededRandom(2) };
      for (let i = 0; i < 6; i++)
        AiService.doAiTurn(turnPlayer(), strength, randoms[turnPlayer() as "self"]);
      return GameApi.getGameState();
    };
    const state = play();
    expect(play()).toEqual(state);
    GameApi.initializeGame({ layer: 2 });
    GameApi.loadGameState(state);
    AiService.doAiTurn(turnPlayer(), strength, rand());
    expect(turnPlayer()).not.toBe(state.turn.player);
  });
});

describe("AiService when commands fail", () => {
  const rejected = { ok: false, error: ActionError.NOT_YOUR_TURN } as const;
  const playTurn = () => AiService.doAiTurn(Player.SELF, AiStrength.STRENGTH_1, rand());

  beforeEach(() => {
    const random = rand();
    for (let i = 0; i < 4; i++) AiService.doAiTurn(turnPlayer(), AiStrength.STRENGTH_1, random);
  });

  test("does nothing on the other player's turn or after the game ended", () => {
    AiService.doAiTurn(Player.OPPONENT, AiStrength.STRENGTH_1, rand());
    expect(turnPlayer()).toBe(Player.SELF);
    TurnRepository.set({ ...TurnRepository.get(), winner: Player.OPPONENT });
    playTurn();
    expect(turnPlayer()).toBe(Player.SELF);
  });

  test("rejected moves and modes still hand the turn over", () => {
    const assignMove = vi.spyOn(GameApiClient, "assignMove").mockReturnValue(rejected);
    vi.spyOn(GameApiClient, "setGenerationMode").mockReturnValue(rejected);
    expect(playTurn).not.toThrow();
    expect(assignMove).toHaveBeenCalled();
    expect(turnPlayer()).toBe(Player.OPPONENT);
  });

  test("a throwing decision still ends the turn once, then rethrows", () => {
    const failure = new Error("decision");
    vi.spyOn(GameApiClient, "setGenerationMode").mockImplementation(() => {
      throw failure;
    });
    const endTurn = vi.spyOn(GameApiClient, "endTurn");
    expect(playTurn).toThrow(failure);
    expect(endTurn).toHaveBeenCalledTimes(1);
    expect(turnPlayer()).toBe(Player.OPPONENT);
  });

  test("endTurn is called once, whether it throws or is rejected", () => {
    const failure = new Error("endTurn");
    const endTurn = vi.spyOn(GameApiClient, "endTurn").mockImplementationOnce(() => {
      throw failure;
    });
    expect(playTurn).toThrow(failure);
    endTurn.mockReturnValueOnce(rejected);
    expect(playTurn).not.toThrow();
    expect(endTurn).toHaveBeenCalledTimes(2);
    expect(turnPlayer()).toBe(Player.SELF);
  });
});
