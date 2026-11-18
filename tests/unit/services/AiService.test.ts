import { afterEach, beforeEach, describe, test, expect, vi } from "vitest";
import { GameApi } from "#lib/api/GameApi.ts";
import { GameApiClient } from "#lib/api/GameApiClient.ts";
import { TurnRepository } from "#lib/store.svelte.ts";
import { ActionError, AiStrength, Player } from "#lib/domain/model.ts";
import { AiService } from "#lib/services/AiService.ts";
import { createSeededRandom } from "#lib/services/ai/random.ts";

const supportedStrengths = [
  AiStrength.STRENGTH_1,
  AiStrength.STRENGTH_2,
  AiStrength.STRENGTH_3,
] as const;

const SEED = 12345;
/** Turns to play before comparing, so the board has pieces with several move choices. */
const REPRODUCIBILITY_TURNS = 6;

describe("AiService", () => {
  beforeEach(() => {
    GameApi.initializeGame({ layer: 4 });
  });

  describe("doAiTurn", () => {
    // Keep this file as a smoke test for supported strengths and turn progression only.
    // Add behavior-specific AI feature coverage to narrower tests outside this file.
    test("does nothing when it is not the given player's turn", () => {
      // Turn starts as SELF, so calling for OPPONENT should be a no-op
      const turnBefore = TurnRepository.get();
      AiService.doAiTurn(Player.OPPONENT, AiStrength.STRENGTH_1, createSeededRandom(SEED));
      const turnAfter = TurnRepository.get();
      expect(turnAfter.player).toBe(turnBefore.player);
      expect(turnAfter.num).toBe(turnBefore.num);
    });

    test("does nothing when game has a winner", () => {
      const turn = TurnRepository.get();
      TurnRepository.set({ ...turn, winner: Player.SELF });
      AiService.doAiTurn(Player.SELF, AiStrength.STRENGTH_1, createSeededRandom(SEED));
      expect(TurnRepository.get().winner).toBe(Player.SELF);
    });

    for (const strength of supportedStrengths) {
      test(`advances the turn with ${strength}`, () => {
        GameApi.initializeGame({ layer: 4 });

        AiService.doAiTurn(Player.SELF, strength, createSeededRandom(SEED));

        expect(TurnRepository.get().player).toBe(Player.OPPONENT);
      });

      test(`can act for Player.OPPONENT with ${strength}`, () => {
        GameApi.endTurn(Player.SELF);

        AiService.doAiTurn(Player.OPPONENT, strength, createSeededRandom(SEED));

        expect(TurnRepository.get().player).toBe(Player.SELF);
      });

      test(`can act from a restored game state with ${strength}`, () => {
        const snapshot = GameApi.getGameState();

        GameApi.initializeGame({ layer: 2 });
        const restoreResult = GameApi.loadGameState(snapshot);
        expect(restoreResult.ok).toBe(true);

        AiService.doAiTurn(Player.SELF, strength, createSeededRandom(SEED));

        expect(TurnRepository.get().player).toBe(Player.OPPONENT);
      });

      test(`reaches the same board from the same board and seed with ${strength}`, () => {
        const playFromStart = () => {
          GameApi.initializeGame({ layer: 4 });
          const randoms = {
            [String(Player.SELF)]: createSeededRandom(SEED),
            [String(Player.OPPONENT)]: createSeededRandom(SEED + 1),
          };
          for (let step = 0; step < REPRODUCIBILITY_TURNS; step += 1) {
            const player = TurnRepository.get().player;
            AiService.doAiTurn(player, strength, randoms[String(player)]);
          }
          return GameApi.getGameState();
        };

        expect(playFromStart()).toEqual(playFromStart());
      });
    }
  });
});

describe("AiService when commands fail", () => {
  /** Turns to play first so that the acting CPU owns pieces it can order. */
  const WARMUP_TURNS = 4;
  const rejected = { ok: false, error: ActionError.NOT_YOUR_TURN } as const;

  beforeEach(() => {
    GameApi.initializeGame({ layer: 4 });
    const random = createSeededRandom(SEED);
    for (let step = 0; step < WARMUP_TURNS; step += 1) {
      AiService.doAiTurn(TurnRepository.get().player, AiStrength.STRENGTH_1, random);
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const playTurn = () =>
    AiService.doAiTurn(Player.SELF, AiStrength.STRENGTH_1, createSeededRandom(SEED));

  test("hands the turn over when every assignMove is rejected", () => {
    expect(GameApi.getGameState().pieces.some((piece) => piece.player === "self")).toBe(true);
    const assignMove = vi.spyOn(GameApiClient, "assignMove").mockReturnValue(rejected);

    expect(playTurn).not.toThrow();

    expect(assignMove).toHaveBeenCalled();
    expect(TurnRepository.get().player).toBe(Player.OPPONENT);
  });

  test("hands the turn over when setGenerationMode is rejected", () => {
    vi.spyOn(GameApiClient, "setGenerationMode").mockReturnValue(rejected);

    expect(playTurn).not.toThrow();

    expect(TurnRepository.get().player).toBe(Player.OPPONENT);
  });

  test("still ends the turn once and rethrows when deciding the turn throws", () => {
    const failure = new Error("decision failed");
    vi.spyOn(GameApiClient, "setGenerationMode").mockImplementation(() => {
      throw failure;
    });
    const endTurn = vi.spyOn(GameApiClient, "endTurn");

    expect(playTurn).toThrow(failure);

    expect(endTurn).toHaveBeenCalledTimes(1);
    expect(TurnRepository.get().player).toBe(Player.OPPONENT);
  });

  test("calls endTurn once and lets its exception through", () => {
    const failure = new Error("endTurn failed");
    const endTurn = vi.spyOn(GameApiClient, "endTurn").mockImplementation(() => {
      throw failure;
    });

    expect(playTurn).toThrow(failure);

    expect(endTurn).toHaveBeenCalledTimes(1);
  });

  test("calls endTurn once and returns quietly when it is rejected", () => {
    const endTurn = vi.spyOn(GameApiClient, "endTurn").mockReturnValue(rejected);

    expect(playTurn).not.toThrow();

    expect(endTurn).toHaveBeenCalledTimes(1);
    expect(TurnRepository.get().player).toBe(Player.SELF);
  });
});
