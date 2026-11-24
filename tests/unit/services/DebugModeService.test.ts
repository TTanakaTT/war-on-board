import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GameApi } from "#lib/api/GameApi.ts";
import { GameApiClient } from "#lib/api/GameApiClient.ts";
import { AiStrength, Player } from "#lib/domain/model.ts";
import type { PlayerController } from "#lib/domain/types.ts";
import { AI_STALL_THRESHOLD_MS, DebugModeService as D } from "#lib/services/DebugModeService.ts";
import { MatchService } from "#lib/services/MatchService.ts";
import {
  DebugModeRepository as R,
  MatchControlRepository,
  TurnRepository,
} from "#lib/store.svelte.ts";

const AI_SEEDS = { self: 12345, opponent: 67890 };
const startMatch = (controller: PlayerController = "human") =>
  MatchService.startMatch({
    controllers: { self: controller, opponent: controller },
    map: "plains",
    automationTurnLimit: 10,
    aiStrengths: { self: AiStrength.STRENGTH_1, opponent: AiStrength.STRENGTH_1 },
    aiSeeds: AI_SEEDS,
  });

/** The next setGenerationMode drives <player>'s resources negative. */
const violateNext = (player: Player) =>
  vi.spyOn(GameApi, "setGenerationMode").mockImplementationOnce(() => {
    const turn = TurnRepository.get();
    TurnRepository.set({ ...turn, resources: { ...turn.resources, [player]: -1 } });
    return { ok: true, value: { gameState: GameApi.getGameState() } };
  });

const setRunning = () => {
  const control = MatchControlRepository.get();
  MatchControlRepository.set({
    ...control,
    automation: { ...control.automation, status: "running" },
  });
};
const types = () => R.getReports().flatMap((r) => r.violations.map((v) => v.type));

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "error").mockImplementation(() => {});
  R.clearReports();
  D.setChecksEnabled(true);
});
afterEach(() => {
  D.setChecksEnabled(false);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("DebugModeService", () => {
  test("records a violation once, with command, states, turn commands and match", () => {
    startMatch();
    GameApiClient.setGenerationMode(Player.SELF, "rear");
    const before = GameApi.getGameState();
    violateNext(Player.SELF);
    GameApiClient.setGenerationMode(Player.SELF, "front");
    GameApiClient.setGenerationMode(Player.SELF, "rear");

    const reports = R.getReports();
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({
      violations: [{ type: "negative-resources" }],
      command: { operation: "setGenerationMode", args: ["self", "front"] },
      before,
      turnCommands: [
        { operation: "setGenerationMode", args: ["self", "rear"] },
        { operation: "setGenerationMode", args: ["self", "front"] },
      ],
      match: {
        map: "plains",
        controllers: { self: "human", opponent: "human" },
        aiSeeds: AI_SEEDS,
      },
    });
  });

  test("turn commands restart with the next player; initializeGame clears reports", () => {
    startMatch();
    GameApiClient.setGenerationMode(Player.SELF, "rear");
    GameApiClient.endTurn(Player.SELF);
    violateNext(Player.OPPONENT);
    GameApiClient.setGenerationMode(Player.OPPONENT, "rear");
    expect(R.getReports()[0].turnCommands).toEqual([
      { operation: "setGenerationMode", args: ["opponent", "rear"] },
    ]);
    GameApiClient.initializeGame({ layer: 4 });
    expect(R.getReportCount()).toBe(0);
  });

  test("records exceptions and one stall per turn after the threshold", () => {
    startMatch();
    D.recordUncaughtException(new Error("boom"));
    D.observeAutomationProgress(0);
    D.observeAutomationProgress(AI_STALL_THRESHOLD_MS);
    expect(types()).toEqual(["uncaught-exception"]);
    setRunning();
    D.observeAutomationProgress(0);
    D.observeAutomationProgress(AI_STALL_THRESHOLD_MS - 1);
    expect(types()).toEqual(["uncaught-exception"]);
    D.observeAutomationProgress(AI_STALL_THRESHOLD_MS);
    D.observeAutomationProgress(AI_STALL_THRESHOLD_MS * 2);
    expect(types()).toEqual(["uncaught-exception", "ai-stalled"]);
  });

  test("records nothing while checks are off", () => {
    startMatch();
    D.setChecksEnabled(false);
    violateNext(Player.SELF);
    GameApiClient.setGenerationMode(Player.SELF, "rear");
    D.recordUncaughtException(new Error("boom"));
    expect(R.getReportCount()).toBe(0);
  });

  test("a violation halts CPU automation", () => {
    startMatch("cpu");
    violateNext(Player.SELF);
    GameApiClient.setGenerationMode(Player.SELF, "rear");
    vi.advanceTimersByTime(0);
    expect(MatchControlRepository.get().automation).toMatchObject({
      status: "idle",
      stopReason: null,
    });
  });
});
