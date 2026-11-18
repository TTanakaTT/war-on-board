import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GameApi } from "#lib/api/GameApi.ts";
import { MatchControlRepository, TurnRepository } from "#lib/store.svelte.ts";
import { AiStrength, Player } from "#lib/domain/model.ts";
import { AiService } from "#lib/services/AiService.ts";
import { MatchService } from "#lib/services/MatchService.ts";

describe("MatchService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("startMatch", () => {
    test("starts a human-vs-human match without auto-playing the opening self turn", () => {
      MatchService.startMatch({
        controllers: {
          self: "human",
          opponent: "human",
        },
        layer: 4,
        automationTurnLimit: 10,
        aiStrengths: {
          self: AiStrength.STRENGTH_2,
          opponent: AiStrength.STRENGTH_3,
        },
      });

      const matchControl = MatchControlRepository.get();
      expect(matchControl.controllers.self).toBe("human");
      expect(matchControl.controllers.opponent).toBe("human");
      expect(matchControl.aiStrengths.self).toBe(AiStrength.STRENGTH_1);
      expect(matchControl.aiStrengths.opponent).toBe(AiStrength.STRENGTH_1);
      expect(matchControl.automation.status).toBe("idle");
      expect(matchControl.automation.stopReason).toBeNull();
      expect(TurnRepository.get().player).toBe(Player.SELF);
      expect(GameApi.getGameStateHistory()).toHaveLength(1);
    });

    test("starts a cpu-vs-human match and auto-plays the opening self turn", async () => {
      MatchService.startMatch({
        controllers: {
          self: "cpu",
          opponent: "human",
        },
        layer: 4,
        automationTurnLimit: 10,
        aiStrengths: {
          self: AiStrength.STRENGTH_2,
          opponent: AiStrength.STRENGTH_3,
        },
      });

      expect(MatchControlRepository.get().automation.status).toBe("running");

      await vi.runAllTimersAsync();

      const matchControl = MatchControlRepository.get();
      expect(matchControl.controllers.self).toBe("cpu");
      expect(matchControl.controllers.opponent).toBe("human");
      expect(matchControl.aiStrengths.self).toBe(AiStrength.STRENGTH_2);
      expect(matchControl.aiStrengths.opponent).toBe(AiStrength.STRENGTH_1);
      expect(matchControl.automation.status).toBe("idle");
      expect(TurnRepository.get().player).toBe(Player.OPPONENT);
      expect(GameApi.getGameStateHistory()).toHaveLength(2);
    });

    test("starts a cpu-vs-cpu match and stops after the configured number of full turns", async () => {
      MatchService.startMatch({
        controllers: {
          self: "cpu",
          opponent: "cpu",
        },
        layer: 4,
        automationTurnLimit: 1,
        aiStrengths: {
          self: AiStrength.STRENGTH_2,
          opponent: AiStrength.STRENGTH_2,
        },
      });

      await vi.runAllTimersAsync();

      const matchControl = MatchControlRepository.get();
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

    test("preserves configured strengths when starting a cpu-vs-cpu match", () => {
      MatchService.startMatch({
        controllers: {
          self: "cpu",
          opponent: "cpu",
        },
        layer: 4,
        automationTurnLimit: 10,
        aiStrengths: {
          self: AiStrength.STRENGTH_3,
          opponent: AiStrength.STRENGTH_1,
        },
      });

      const matchControl = MatchControlRepository.get();

      expect(matchControl.aiStrengths.self).toBe(AiStrength.STRENGTH_3);
      expect(matchControl.aiStrengths.opponent).toBe(AiStrength.STRENGTH_1);
    });
  });

  describe("aiSeeds", () => {
    const cpuVsCpuOptions = {
      controllers: { self: "cpu", opponent: "cpu" },
      layer: 4,
      automationTurnLimit: 3,
      aiStrengths: { self: AiStrength.STRENGTH_1, opponent: AiStrength.STRENGTH_3 },
    } as const;

    test("stores the given seeds in the match control", () => {
      MatchService.startMatch({ ...cpuVsCpuOptions, aiSeeds: { self: 12345, opponent: 67890 } });

      expect(MatchControlRepository.get().aiSeeds).toEqual({ self: 12345, opponent: 67890 });
    });

    test("creates a 32-bit unsigned integer seed for each player when none are given", () => {
      MatchService.startMatch(cpuVsCpuOptions);

      const { aiSeeds } = MatchControlRepository.get();
      for (const seed of [aiSeeds.self, aiSeeds.opponent]) {
        expect(Number.isInteger(seed)).toBe(true);
        expect(seed).toBeGreaterThanOrEqual(0);
        expect(seed).toBeLessThan(2 ** 32);
      }
    });

    test("replays the same cpu-vs-cpu match from the same seeds", async () => {
      const playMatch = async () => {
        MatchService.startMatch({ ...cpuVsCpuOptions, aiSeeds: { self: 1, opponent: 2 } });
        await vi.runAllTimersAsync();
        return GameApi.getGameState();
      };

      const firstBoard = await playMatch();
      const secondBoard = await playMatch();

      expect(MatchControlRepository.get().automation.automatedTurns).toBe(
        cpuVsCpuOptions.automationTurnLimit,
      );
      expect(secondBoard).toEqual(firstBoard);
    });
  });

  describe("runAutomatedTurnsIfNeeded", () => {
    test("runs the opponent cpu response after a human ends the turn", async () => {
      MatchService.startMatch({
        controllers: {
          self: "human",
          opponent: "cpu",
        },
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
      MatchService.startMatch({
        controllers: {
          self: "cpu",
          opponent: "cpu",
        },
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

  describe("when the cpu turn fails", () => {
    const cpuVsCpuOptions = {
      controllers: { self: "cpu", opponent: "cpu" },
      layer: 4,
      automationTurnLimit: 10,
      aiStrengths: { self: AiStrength.STRENGTH_1, opponent: AiStrength.STRENGTH_1 },
      aiSeeds: { self: 1, opponent: 2 },
    } as const;
    const stepDelayMs = MatchService.getAutomationStepDelayMs();

    afterEach(() => {
      vi.restoreAllMocks();
    });

    test("rethrows and keeps running when the turn ended before the exception", async () => {
      const failure = new Error("cpu failed after ending the turn");
      const realDoAiTurn = AiService.doAiTurn.bind(AiService);
      const doAiTurn = vi
        .spyOn(AiService, "doAiTurn")
        .mockImplementationOnce((player, strength, random) => {
          realDoAiTurn(player, strength, random);
          throw failure;
        });
      MatchService.startMatch(cpuVsCpuOptions);

      await expect(vi.advanceTimersByTimeAsync(stepDelayMs)).rejects.toThrow(failure);

      expect(TurnRepository.get().player).toBe(Player.OPPONENT);
      expect(MatchControlRepository.get().automation.status).toBe("running");

      await vi.advanceTimersByTimeAsync(stepDelayMs);

      expect(doAiTurn).toHaveBeenCalledTimes(2);
      expect(doAiTurn).toHaveBeenLastCalledWith(
        Player.OPPONENT,
        expect.anything(),
        expect.anything(),
      );
    });

    test("rethrows and halts when the exception came before the turn ended", async () => {
      const failure = new Error("cpu failed before ending the turn");
      const doAiTurn = vi.spyOn(AiService, "doAiTurn").mockImplementation(() => {
        throw failure;
      });
      MatchService.startMatch(cpuVsCpuOptions);

      await expect(vi.advanceTimersByTimeAsync(stepDelayMs)).rejects.toThrow(failure);

      const { automation } = MatchControlRepository.get();
      expect(automation.status).toBe("idle");
      expect(automation.stopReason).toBeNull();

      await vi.runAllTimersAsync();

      expect(doAiTurn).toHaveBeenCalledTimes(1);
      expect(TurnRepository.get().player).toBe(Player.SELF);
    });

    test("halts instead of retrying forever when the turn could not be ended", async () => {
      const doAiTurn = vi.spyOn(AiService, "doAiTurn").mockImplementation(() => {});
      MatchService.startMatch(cpuVsCpuOptions);

      await vi.advanceTimersByTimeAsync(stepDelayMs);

      const { automation } = MatchControlRepository.get();
      expect(automation.status).toBe("idle");
      expect(automation.stopReason).toBeNull();

      await vi.runAllTimersAsync();

      expect(doAiTurn).toHaveBeenCalledTimes(1);
      expect(TurnRepository.get().player).toBe(Player.SELF);
    });
  });

  describe("haltAutomation", () => {
    test("cancels scheduled automation and leaves it idle without a stop reason", async () => {
      MatchService.startMatch({
        controllers: {
          self: "cpu",
          opponent: "cpu",
        },
        layer: 4,
        automationTurnLimit: 10,
        aiStrengths: {
          self: AiStrength.STRENGTH_1,
          opponent: AiStrength.STRENGTH_1,
        },
      });
      expect(MatchControlRepository.get().automation.status).toBe("running");

      MatchService.haltAutomation();
      await vi.runAllTimersAsync();

      const { automation } = MatchControlRepository.get();
      expect(automation.status).toBe("idle");
      expect(automation.stopReason).toBeNull();
      expect(TurnRepository.get().player).toBe(Player.SELF);
      expect(GameApi.getGameStateHistory()).toHaveLength(1);
    });
  });
});
