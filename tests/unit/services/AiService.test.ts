import { beforeEach, describe, test, expect } from "vitest";
import { GameApi } from "#lib/api/GameApi.ts";
import { TurnRepository } from "#lib/data/repositories/TurnRepository.ts";
import { AiStrength } from "#lib/domain/enums/AiStrength.ts";
import { Player } from "#lib/domain/enums/Player.ts";
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
