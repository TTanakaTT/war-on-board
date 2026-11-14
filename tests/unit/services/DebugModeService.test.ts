import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GameApi } from "$lib/api/GameApi";
import { GameApiClient } from "$lib/api/GameApiClient";
import { DebugModeRepository } from "$lib/data/repositories/DebugModeRepository";
import { MatchControlRepository } from "$lib/data/repositories/MatchControlRepository";
import { TurnRepository } from "$lib/data/repositories/TurnRepository";
import { AiStrength } from "$lib/domain/enums/AiStrength";
import { Player } from "$lib/domain/enums/Player";
import type { PlayerController } from "$lib/domain/types/match";
import { AI_STALL_THRESHOLD_MS, DebugModeService } from "$lib/services/DebugModeService";
import { MatchService } from "$lib/services/MatchService";

const LAYER = 4;

function startMatch(controller: PlayerController = "human"): void {
  MatchService.startMatch({
    controllers: { self: controller, opponent: controller },
    layer: LAYER,
    automationTurnLimit: 10,
    aiStrengths: { self: AiStrength.STRENGTH_1, opponent: AiStrength.STRENGTH_1 },
  });
}

/** Makes the next setGenerationMode call drive <player>'s resources negative. */
function makeNextSetGenerationModeViolate(player: Player): void {
  vi.spyOn(GameApi, "setGenerationMode").mockImplementationOnce(() => {
    const turn = TurnRepository.get();
    TurnRepository.set({ ...turn, resources: { ...turn.resources, [String(player)]: -1 } });
    return { ok: true, value: { gameState: GameApi.getGameState() } };
  });
}

function setAutomationRunning(): void {
  const matchControl = MatchControlRepository.get();
  MatchControlRepository.set({
    ...matchControl,
    automation: { ...matchControl.automation, status: "running" },
  });
}

describe("DebugModeService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
    DebugModeService.setChecksEnabled(false);
    DebugModeRepository.clearReports();
    DebugModeService.setChecksEnabled(true);
  });

  afterEach(() => {
    DebugModeService.setChecksEnabled(false);
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("command checks", () => {
    test("records one report with the command, states, turn commands, and match conditions", () => {
      startMatch();
      GameApiClient.setGenerationMode(Player.SELF, "rear");
      const before = GameApi.getGameState();
      makeNextSetGenerationModeViolate(Player.SELF);

      GameApiClient.setGenerationMode(Player.SELF, "front");

      const reports = DebugModeRepository.getReports();
      expect(reports).toHaveLength(1);
      const [report] = reports;
      expect(report.violations.map((violation) => violation.type)).toEqual(["negative-resources"]);
      expect(report.command).toEqual({ operation: "setGenerationMode", args: ["self", "front"] });
      expect(report.before).toEqual(before);
      expect(report.after).toEqual(GameApi.getGameState());
      expect(report.turnCommands).toEqual([
        { operation: "setGenerationMode", args: ["self", "rear"] },
        { operation: "setGenerationMode", args: ["self", "front"] },
      ]);
      expect(report.match).toEqual({
        layer: LAYER,
        controllers: { self: "human", opponent: "human" },
        aiStrengths: { self: AiStrength.STRENGTH_1, opponent: AiStrength.STRENGTH_1 },
      });
    });

    test("does not record the same violation again on a later command", () => {
      startMatch();
      makeNextSetGenerationModeViolate(Player.SELF);
      GameApiClient.setGenerationMode(Player.SELF, "rear");

      GameApiClient.setGenerationMode(Player.SELF, "front");

      expect(DebugModeRepository.getReportCount()).toBe(1);
    });

    test("restarts turn commands when endTurn hands the turn to the other player", () => {
      startMatch();
      GameApiClient.setGenerationMode(Player.SELF, "rear");
      GameApiClient.endTurn(Player.SELF);
      makeNextSetGenerationModeViolate(Player.OPPONENT);

      GameApiClient.setGenerationMode(Player.OPPONENT, "rear");

      const [report] = DebugModeRepository.getReports();
      expect(report.turnCommands).toEqual([
        { operation: "setGenerationMode", args: ["opponent", "rear"] },
      ]);
    });

    test("initializeGame clears earlier reports", () => {
      startMatch();
      makeNextSetGenerationModeViolate(Player.SELF);
      GameApiClient.setGenerationMode(Player.SELF, "rear");
      expect(DebugModeRepository.getReportCount()).toBe(1);

      GameApiClient.initializeGame({ layer: LAYER });

      expect(DebugModeRepository.getReportCount()).toBe(0);
    });
  });

  test("records nothing for commands, exceptions, or stalls while checks are off", () => {
    startMatch();
    DebugModeService.setChecksEnabled(false);

    makeNextSetGenerationModeViolate(Player.SELF);
    GameApiClient.setGenerationMode(Player.SELF, "rear");
    DebugModeService.recordUncaughtException(new Error("boom"));
    setAutomationRunning();
    DebugModeService.observeAutomationProgress(0);
    DebugModeService.observeAutomationProgress(AI_STALL_THRESHOLD_MS);

    expect(DebugModeRepository.getReportCount()).toBe(0);
  });

  test("recordUncaughtException records an uncaught-exception", () => {
    startMatch();

    DebugModeService.recordUncaughtException(new Error("boom"));

    const [report] = DebugModeRepository.getReports();
    expect(report.violations.map((violation) => violation.type)).toEqual(["uncaught-exception"]);
    expect(report.command).toBeNull();
  });

  describe("observeAutomationProgress", () => {
    test("records ai-stalled once when the turn does not advance for the threshold", () => {
      startMatch();
      setAutomationRunning();

      DebugModeService.observeAutomationProgress(0);
      DebugModeService.observeAutomationProgress(AI_STALL_THRESHOLD_MS);
      DebugModeService.observeAutomationProgress(AI_STALL_THRESHOLD_MS * 2);

      const reports = DebugModeRepository.getReports();
      expect(reports).toHaveLength(1);
      expect(reports[0].violations.map((violation) => violation.type)).toEqual(["ai-stalled"]);
    });

    test("does not record ai-stalled before the threshold", () => {
      startMatch();
      setAutomationRunning();

      DebugModeService.observeAutomationProgress(0);
      DebugModeService.observeAutomationProgress(AI_STALL_THRESHOLD_MS - 1);

      expect(DebugModeRepository.getReportCount()).toBe(0);
    });

    test("does not record ai-stalled while automation is not running", () => {
      startMatch();

      DebugModeService.observeAutomationProgress(0);
      DebugModeService.observeAutomationProgress(AI_STALL_THRESHOLD_MS);

      expect(DebugModeRepository.getReportCount()).toBe(0);
    });
  });

  test("halts CPU automation after recording a violation", () => {
    startMatch("cpu");
    expect(MatchControlRepository.get().automation.status).toBe("running");
    makeNextSetGenerationModeViolate(Player.SELF);

    GameApiClient.setGenerationMode(Player.SELF, "rear");
    vi.advanceTimersByTime(0);

    const { automation } = MatchControlRepository.get();
    expect(automation.status).toBe("idle");
    expect(automation.stopReason).toBeNull();
  });
});
