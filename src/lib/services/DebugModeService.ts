import { GameApi } from "$lib/api/GameApi";
import { GameApiClient, type GameApiCommandEvent } from "$lib/api/GameApiClient";
import { DebugModeRepository } from "$lib/data/repositories/DebugModeRepository";
import { LayerRepository } from "$lib/data/repositories/LayerRepository";
import { MatchControlRepository } from "$lib/data/repositories/MatchControlRepository";
import type { GameStateSnapshot } from "$lib/domain/types/api";
import type {
  InvariantMatchConditions,
  InvariantViolation,
  InvariantViolationReport,
  RecordedCommand,
} from "$lib/domain/types/invariant";
import { InvariantService } from "$lib/services/InvariantService";
import { MatchService } from "$lib/services/MatchService";

/** How long CPU automation may run without the turn advancing before it counts as stalled. */
export const AI_STALL_THRESHOLD_MS = 5000;

interface AutomationProgress {
  signature: string;
  sinceMs: number;
  reported: boolean;
}

/**
 * DebugModeService — dev-build-only invariant monitoring.
 *
 * While checks are enabled, every command that goes through GameApiClient is checked with
 * InvariantService. Uncaught exceptions and stalled CPU automation are reported too. Each
 * detection is recorded, logged to the console, and halts CPU automation so the board can
 * be inspected. Browser wiring (listeners, timers, the window handle) lives in
 * presentation/debugMode.ts; this service never touches browser APIs itself.
 */
export class DebugModeService {
  private static detachObserver: (() => void) | null = null;
  private static turnCommands: RecordedCommand[] = [];
  private static automationProgress: AutomationProgress | null = null;

  static isChecksEnabled(): boolean {
    return DebugModeRepository.isChecksEnabled();
  }

  static setChecksEnabled(enabled: boolean): void {
    DebugModeRepository.setChecksEnabled(enabled);

    if (enabled) {
      this.detachObserver ??= GameApiClient.observe((event) => this.handleCommand(event));
      return;
    }

    this.detachObserver?.();
    this.detachObserver = null;
    this.turnCommands = [];
    this.automationProgress = null;
  }

  static handleCommand(event: GameApiCommandEvent): void {
    if (!this.isChecksEnabled()) return;

    const command: RecordedCommand = {
      operation: event.operation,
      args: event.args.map(serializeCommandArg),
    };

    if (event.operation === "initializeGame") {
      // A new game starts from scratch: earlier detections and turn history no longer apply.
      DebugModeRepository.clearReports();
      this.turnCommands = [];
      this.automationProgress = null;
      this.report(InvariantService.check(event.after), command, [command], null, event.after);
      return;
    }

    this.turnCommands.push(command);
    const turnCommands = [...this.turnCommands];
    if (hasTurnChanged(event.before, event.after)) {
      this.turnCommands = [];
    }

    this.report(
      InvariantService.findIntroducedViolations(event.before, event.after),
      command,
      turnCommands,
      event.before,
      event.after,
    );
  }

  static recordUncaughtException(error: unknown): void {
    if (!this.isChecksEnabled()) return;

    const detail =
      error instanceof Error
        ? `${error.name}: ${error.message}\n${error.stack ?? ""}`.trim()
        : String(error);

    this.report(
      [{ type: "uncaught-exception", key: `uncaught-exception:${detail}`, detail }],
      null,
      [...this.turnCommands],
      null,
      GameApi.getGameState(),
    );
  }

  /**
   * Called periodically with the current time. Reports `ai-stalled` once when CPU automation
   * has been running for AI_STALL_THRESHOLD_MS without the turn advancing.
   */
  static observeAutomationProgress(nowMs: number): void {
    if (!this.isChecksEnabled()) return;

    if (MatchControlRepository.get().automation.status !== "running") {
      this.automationProgress = null;
      return;
    }

    const turn = GameApi.getGameState().turn;
    const signature = `${turn.num}:${turn.player}:${turn.winner}`;
    if (this.automationProgress?.signature !== signature) {
      this.automationProgress = { signature, sinceMs: nowMs, reported: false };
      return;
    }

    const stalledMs = nowMs - this.automationProgress.sinceMs;
    if (this.automationProgress.reported || stalledMs < AI_STALL_THRESHOLD_MS) return;

    this.automationProgress.reported = true;
    this.report(
      [
        {
          type: "ai-stalled",
          key: `ai-stalled:${signature}`,
          detail: `turn ${turn.num} (${turn.player}) did not advance for ${stalledMs}ms while CPU automation was running`,
        },
      ],
      null,
      [...this.turnCommands],
      null,
      GameApi.getGameState(),
    );
  }

  private static report(
    violations: InvariantViolation[],
    command: RecordedCommand | null,
    turnCommands: RecordedCommand[],
    before: GameStateSnapshot | null,
    after: GameStateSnapshot,
  ): void {
    if (violations.length === 0) return;

    const report: InvariantViolationReport = {
      violations,
      match: this.getMatchConditions(),
      command,
      turnCommands,
      before,
      after,
    };

    DebugModeRepository.addReport(report);
    console.error(
      `[Invariant] ${violations.map((violation) => violation.type).join(", ")}`,
      report,
    );

    // Deferred: a detection inside an automation step would otherwise be overwritten when
    // that step stores its own match control right after the AI's command returns.
    setTimeout(() => MatchService.haltAutomation(), 0);
  }

  private static getMatchConditions(): InvariantMatchConditions {
    const matchControl = MatchControlRepository.get();

    return {
      layer: LayerRepository.get(),
      controllers: { ...matchControl.controllers },
      aiStrengths: { ...matchControl.aiStrengths },
    };
  }
}

function hasTurnChanged(before: GameStateSnapshot, after: GameStateSnapshot): boolean {
  return before.turn.num !== after.turn.num || before.turn.player !== after.turn.player;
}

/** Converts enum-like class instances (Player, PieceType) to their string values. */
function serializeCommandArg(arg: unknown): unknown {
  if (arg !== null && typeof arg === "object" && Symbol.toPrimitive in arg) {
    return String(arg);
  }

  return arg === undefined ? null : JSON.parse(JSON.stringify(arg));
}
