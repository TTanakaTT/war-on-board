import { GameApi } from "#lib/api/GameApi.ts";
import { GameApiClient, type GameApiCommandName } from "#lib/api/GameApiClient.ts";
import type { GameState } from "#lib/domain/model.ts";
import type { InvariantViolation, RecordedCommand } from "#lib/domain/types.ts";
import { DebugModeRepository, LayerRepository, MatchControlRepository } from "#lib/store.svelte.ts";
import { InvariantService } from "#lib/services/InvariantService.ts";
import { MatchService } from "#lib/services/MatchService.ts";

/** CPU automation running this long without the turn advancing counts as stalled. */
export const AI_STALL_THRESHOLD_MS = 5000;

export interface CheckedCommand {
  operation: GameApiCommandName;
  args: unknown[];
  before: GameState;
  after: GameState;
}

/**
 * Dev-build-only monitoring: checks invariants after every GameApiClient command and records
 * uncaught exceptions and stalled automation. Each detection is logged and halts automation.
 * Browser wiring lives in presentation/debugMode.ts.
 */
export class DebugModeService {
  private static turnCommands: RecordedCommand[] = [];
  private static automationProgress: {
    signature: string;
    sinceMs: number;
    reported: boolean;
  } | null = null;

  static setChecksEnabled(enabled: boolean): void {
    DebugModeRepository.setChecksEnabled(enabled);
    GameApiClient.setInterceptor(
      enabled
        ? (operation, args, execute) => {
            const before = GameApi.getGameState();
            const result = execute();
            this.handleCommand({ operation, args, before, after: GameApi.getGameState() });
            return result;
          }
        : null,
    );
    if (!enabled) this.resetTracking();
  }

  static handleCommand({ operation, args, before, after }: CheckedCommand): void {
    if (!DebugModeRepository.isChecksEnabled()) return;
    // Plain JSON args so reports can be stored and copied into issues.
    const command: RecordedCommand = {
      operation,
      args: args.map((arg) => (arg === undefined ? null : JSON.parse(JSON.stringify(arg)))),
    };

    if (operation === "initializeGame") {
      DebugModeRepository.clearReports();
      this.resetTracking();
      this.report(InvariantService.check(after), command, [command], null, after);
      return;
    }

    this.turnCommands.push(command);
    const turnCommands = [...this.turnCommands];
    if (before.turn.num !== after.turn.num || before.turn.player !== after.turn.player) {
      this.turnCommands = [];
    }
    this.report(
      InvariantService.findIntroducedViolations(before, after),
      command,
      turnCommands,
      before,
      after,
    );
  }

  static recordUncaughtException(error: unknown): void {
    if (!DebugModeRepository.isChecksEnabled()) return;
    const detail =
      error instanceof Error
        ? `${error.name}: ${error.message}\n${error.stack ?? ""}`.trim()
        : String(error);
    this.reportRuntime({ type: "uncaught-exception", key: `uncaught-exception:${detail}`, detail });
  }

  /** Called periodically; reports `ai-stalled` once per stalled turn. */
  static observeAutomationProgress(nowMs: number): void {
    if (!DebugModeRepository.isChecksEnabled()) return;
    if (MatchControlRepository.get().automation.status !== "running") {
      this.automationProgress = null;
      return;
    }

    const turn = GameApi.getGameState().turn;
    const signature = `${turn.num}:${turn.player}:${turn.winner}`;
    const progress = this.automationProgress;
    if (progress?.signature !== signature) {
      this.automationProgress = { signature, sinceMs: nowMs, reported: false };
      return;
    }
    const stalledMs = nowMs - progress.sinceMs;
    if (progress.reported || stalledMs < AI_STALL_THRESHOLD_MS) return;

    progress.reported = true;
    this.reportRuntime({
      type: "ai-stalled",
      key: `ai-stalled:${signature}`,
      detail: `turn ${turn.num} (${turn.player}) did not advance for ${stalledMs}ms while CPU automation was running`,
    });
  }

  private static resetTracking() {
    this.turnCommands = [];
    this.automationProgress = null;
  }

  private static reportRuntime(violation: InvariantViolation) {
    this.report([violation], null, [...this.turnCommands], null, GameApi.getGameState());
  }

  private static report(
    violations: InvariantViolation[],
    command: RecordedCommand | null,
    turnCommands: RecordedCommand[],
    before: GameState | null,
    after: GameState,
  ): void {
    if (violations.length === 0) return;
    const { controllers, aiStrengths, aiSeeds } = MatchControlRepository.get();
    const report = {
      violations,
      match: { layer: LayerRepository.get(), controllers, aiStrengths, aiSeeds },
      command,
      turnCommands,
      before,
      after,
    };
    DebugModeRepository.addReport(report);
    console.error(`[Invariant] ${violations.map((v) => v.type).join(", ")}`, report);
    // Deferred: an automation step would otherwise overwrite the halt right after this command.
    setTimeout(() => MatchService.haltAutomation(), 0);
  }
}
