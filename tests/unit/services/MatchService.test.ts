import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GameApi } from "$lib/api/GameApi";
import { TurnRepository } from "$lib/data/repositories/TurnRepository";
import { MatchControlRepository } from "$lib/data/repositories/MatchControlRepository";
import { AiStrength } from "$lib/domain/enums/AiStrength";
import { Player } from "$lib/domain/enums/Player";
import { MatchService } from "$lib/services/MatchService";

describe("MatchService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    GameApi.initializeGame({ layer: 4 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("startMatch", () => {
    test("starts a human-vs-cpu match without auto-playing the opening self turn", () => {
      MatchService.startMatch("human-vs-cpu", {
        layer: 4,
        automationTurnLimit: 10,
        aiStrengths: {
          self: AiStrength.STRENGTH_2,
          opponent: AiStrength.STRENGTH_2,
        },
      });

      const matchControl = MatchControlRepository.get();

      expect(matchControl.mode).toBe("human-vs-cpu");
      expect(matchControl.controllers.self).toBe("human");
      expect(matchControl.controllers.opponent).toBe("cpu");
      expect(matchControl.aiStrengths.self).toBe(AiStrength.STRENGTH_1);
      expect(matchControl.aiStrengths.opponent).toBe(AiStrength.STRENGTH_2);
      expect(matchControl.automation.status).toBe("idle");
      expect(matchControl.automation.stopReason).toBeNull();
      expect(TurnRepository.get().player).toBe(Player.SELF);
      expect(GameApi.getGameStateHistory()).toHaveLength(1);
    });

    test("starts a cpu-vs-cpu match and stops after the configured number of full turns", async () => {
      MatchService.startMatch("cpu-vs-cpu", {
        layer: 4,
        automationTurnLimit: 1,
        aiStrengths: {
          self: AiStrength.STRENGTH_2,
          opponent: AiStrength.STRENGTH_2,
        },
      });

      await vi.runAllTimersAsync();

      const matchControl = MatchControlRepository.get();

      expect(matchControl.mode).toBe("cpu-vs-cpu");
      expect(matchControl.controllers.self).toBe("cpu");
      expect(matchControl.controllers.opponent).toBe("cpu");
      expect(matchControl.aiStrengths.self).toBe(AiStrength.STRENGTH_2);
      expect(matchControl.aiStrengths.opponent).toBe(AiStrength.STRENGTH_2);
      expect(matchControl.automation.status).toBe("stopped");
      expect(matchControl.automation.stopReason).toBe("turn-limit");
      expect(matchControl.automation.automatedTurns).toBe(1);
      expect(TurnRepository.get().player).toBe(Player.SELF);
      expect(TurnRepository.get().num).toBe(2);
      expect(TurnRepository.get().winner).toBeNull();
      expect(GameApi.getGameStateHistory()).toHaveLength(3);
    });
  });

  describe("runAutomatedTurnsIfNeeded", () => {
    test("runs the opponent cpu response after a human ends the turn", async () => {
      MatchService.startMatch("human-vs-cpu", {
        layer: 4,
        automationTurnLimit: 10,
        aiStrengths: {
          self: AiStrength.STRENGTH_1,
          opponent: AiStrength.STRENGTH_2,
        },
      });

      const endTurnResult = GameApi.endTurn(Player.SELF);
      expect(endTurnResult.ok).toBe(true);

      MatchService.runAutomatedTurnsIfNeeded();

      expect(MatchControlRepository.get().automation.status).toBe("running");

      await vi.runAllTimersAsync();

      expect(TurnRepository.get().player).toBe(Player.SELF);
      expect(MatchControlRepository.get().automation.status).toBe("idle");
      expect(GameApi.getGameStateHistory()).toHaveLength(3);
    });

    test("schedules cpu-vs-cpu turns asynchronously while counting completed full turns", async () => {
      MatchService.startMatch("cpu-vs-cpu", {
        layer: 4,
        automationTurnLimit: 2,
        aiStrengths: {
          self: AiStrength.STRENGTH_2,
          opponent: AiStrength.STRENGTH_1,
        },
      });

      expect(TurnRepository.get().player).toBe(Player.SELF);
      expect(GameApi.getGameStateHistory()).toHaveLength(1);

      await vi.advanceTimersByTimeAsync(MatchService.getAutomationStepDelayMs());

      expect(GameApi.getGameStateHistory()).toHaveLength(2);
      expect(TurnRepository.get().player).toBe(Player.OPPONENT);
      expect(MatchControlRepository.get().automation.automatedTurns).toBe(0);

      await vi.runAllTimersAsync();

      expect(GameApi.getGameStateHistory()).toHaveLength(5);
      expect(TurnRepository.get().num).toBe(3);
      expect(MatchControlRepository.get().automation.automatedTurns).toBe(2);
      expect(MatchControlRepository.get().automation.stopReason).toBe("turn-limit");
    });
  });
});
