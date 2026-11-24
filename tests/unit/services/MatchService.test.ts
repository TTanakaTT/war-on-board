import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GameApi } from "#lib/api/GameApi.ts";
import { AiStrength, Player } from "#lib/domain/model.ts";
import type { PlayerController, StartMatchOptions } from "#lib/domain/types.ts";
import { AiService } from "#lib/services/AiService.ts";
import { MatchService } from "#lib/services/MatchService.ts";
import { MatchControlRepository, TurnRepository } from "#lib/store.svelte.ts";

const STEP = MatchService.getAutomationStepDelayMs();
const options = (
  self: PlayerController,
  opponent: PlayerController,
  extra: Partial<StartMatchOptions> = {},
): StartMatchOptions => ({
  controllers: { self, opponent },
  map: "plains",
  automationTurnLimit: 10,
  aiStrengths: { self: AiStrength.STRENGTH_2, opponent: AiStrength.STRENGTH_3 },
  aiSeeds: { self: 1, opponent: 2 },
  ...extra,
});
const automation = () => MatchControlRepository.get().automation;
const history = () => GameApi.getGameStateHistory().length;

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("MatchService", () => {
  test("humans get the base strength and no automation", () => {
    MatchService.startMatch(options("human", "human"));
    expect(MatchControlRepository.get().aiStrengths).toEqual({
      self: AiStrength.STRENGTH_1,
      opponent: AiStrength.STRENGTH_1,
    });
    expect(automation().status).toBe("idle");
    expect(history()).toBe(1);
  });

  test("a CPU first player moves after one step, then waits for the human", async () => {
    MatchService.startMatch(options("cpu", "human"));
    expect(automation().status).toBe("running");
    await vi.runAllTimersAsync();
    expect(MatchControlRepository.get().aiStrengths.self).toBe(AiStrength.STRENGTH_2);
    expect(automation().status).toBe("idle");
    expect(TurnRepository.get().player).toBe(Player.OPPONENT);

    GameApi.endTurn(Player.OPPONENT);
    MatchService.runAutomatedTurnsIfNeeded();
    await vi.runAllTimersAsync();
    expect(TurnRepository.get().player).toBe(Player.OPPONENT);
    expect(history()).toBe(4);
  });

  test("CPU vs CPU counts full turns and stops at the limit", async () => {
    MatchService.startMatch(options("cpu", "cpu", { automationTurnLimit: 2 }));
    await vi.advanceTimersByTimeAsync(STEP);
    expect([history(), automation().automatedTurns]).toEqual([2, 0]);
    await vi.runAllTimersAsync();
    expect(automation()).toMatchObject({
      status: "stopped",
      stopReason: "turn-limit",
      automatedTurns: 2,
    });
    expect(TurnRepository.get().num).toBe(3);
  });

  test("seeds are stored, generated when missing, and replay the same match", async () => {
    MatchService.startMatch(options("cpu", "cpu", { aiSeeds: undefined }));
    const { aiSeeds } = MatchControlRepository.get();
    for (const seed of [aiSeeds.self, aiSeeds.opponent]) {
      expect(Number.isInteger(seed) && seed >= 0 && seed < 2 ** 32).toBe(true);
    }
    const play = async () => {
      MatchService.startMatch(options("cpu", "cpu", { automationTurnLimit: 3 }));
      await vi.runAllTimersAsync();
      return GameApi.getGameState();
    };
    expect(await play()).toEqual(await play());
  });

  test("an exception after the turn ended is rethrown and automation keeps running", async () => {
    const real = AiService.doAiTurn.bind(AiService);
    const failure = new Error("after");
    const spy = vi.spyOn(AiService, "doAiTurn").mockImplementationOnce((...args) => {
      real(...args);
      throw failure;
    });
    MatchService.startMatch(options("cpu", "cpu"));
    await expect(vi.advanceTimersByTimeAsync(STEP)).rejects.toThrow(failure);
    expect(automation().status).toBe("running");
    await vi.advanceTimersByTimeAsync(STEP);
    expect(spy).toHaveBeenLastCalledWith(Player.OPPONENT, expect.anything(), expect.anything());
  });

  test.each([
    [
      "throws first",
      () => {
        throw new Error("before");
      },
    ],
    ["never ends its turn", () => {}],
  ])("a CPU that %s halts automation without a stop reason", async (_, impl) => {
    const spy = vi.spyOn(AiService, "doAiTurn").mockImplementation(impl);
    MatchService.startMatch(options("cpu", "cpu"));
    await vi.advanceTimersByTimeAsync(STEP).catch(() => {});
    await vi.runAllTimersAsync();
    expect(automation()).toMatchObject({ status: "idle", stopReason: null });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  test("haltAutomation cancels a scheduled step", async () => {
    MatchService.startMatch(options("cpu", "cpu"));
    MatchService.haltAutomation();
    await vi.runAllTimersAsync();
    expect(automation()).toMatchObject({ status: "idle", stopReason: null });
    expect(history()).toBe(1);
  });
});
