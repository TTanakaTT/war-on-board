import { goto } from "$app/navigation";
import { resolve } from "$app/paths";
import { DebugModeRepository } from "$lib/data/repositories/DebugModeRepository";
import { MatchControlRepository } from "$lib/data/repositories/MatchControlRepository";
import { TurnRepository } from "$lib/data/repositories/TurnRepository";
import type { InvariantViolationReport, InvariantViolationType } from "$lib/domain/types/invariant";
import type {
  AutomationStatus,
  AutomationStopReason,
  StartMatchOptions,
} from "$lib/domain/types/match";
import { DebugModeService } from "$lib/services/DebugModeService";
import { MatchService } from "$lib/services/MatchService";

const DEBUG_CHECKS_STORAGE_KEY = "war-on-board-debug-checks";
const AUTOMATION_PROGRESS_CHECK_INTERVAL_MS = 1000;

// Dev-build-only text: English literals on purpose, not Paraglide messages (see CLAUDE.md).
const VIOLATION_TYPE_LABELS: Record<InvariantViolationType, string> = {
  "piece-capacity-exceeded": "Too many pieces on a panel",
  "mixed-players-on-panel": "Both players' pieces on one panel",
  "piece-hp-out-of-range": "Piece HP out of range",
  "movement-points-out-of-range": "Movement points out of range",
  "duplicate-piece-id": "Duplicate piece ID",
  "piece-off-board": "Piece position off the board",
  "unmerged-pieces": "Unmerged pieces",
  "negative-resources": "Negative resources",
  "state-changed-after-winner": "State changed after the game ended",
  "uncaught-exception": "Uncaught exception",
  "ai-stalled": "AI turn stalled",
};

export interface DebugModeStatus {
  winner: string | null;
  automationStatus: AutomationStatus;
  stopReason: AutomationStopReason;
  reportCount: number;
}

/** Dev-build-only handle on `window`, used by the browser simulation in tests/simulation. */
export interface WarOnBoardDebugHandle {
  startMatch(options: StartMatchOptions): Promise<void>;
  getStatus(): DebugModeStatus;
  getReports(): InvariantViolationReport[];
  getViolationTypeLabel(type: InvariantViolationType): string;
}

export function violationTypeLabel(type: InvariantViolationType): string {
  return VIOLATION_TYPE_LABELS[type];
}

export function loadDebugChecksPreference(): boolean {
  try {
    return localStorage.getItem(DEBUG_CHECKS_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

export function saveDebugChecksPreference(enabled: boolean): void {
  try {
    localStorage.setItem(DEBUG_CHECKS_STORAGE_KEY, String(enabled));
  } catch {
    // Storage may be unavailable (private mode); the choice then lasts for this page only.
  }
}

/**
 * Starts dev-build-only monitoring: applies the saved checks preference, reports uncaught
 * exceptions and stalled CPU automation, and exposes `window.__WAR_ON_BOARD_DEBUG__`.
 * Returns a function that undoes all of it.
 */
export function installDebugModeMonitor(): () => void {
  DebugModeService.setChecksEnabled(loadDebugChecksPreference());

  const handleError = (event: ErrorEvent) => {
    DebugModeService.recordUncaughtException(event.error ?? event.message);
  };
  const handleRejection = (event: PromiseRejectionEvent) => {
    DebugModeService.recordUncaughtException(event.reason);
  };
  window.addEventListener("error", handleError);
  window.addEventListener("unhandledrejection", handleRejection);

  const progressTimer = window.setInterval(() => {
    DebugModeService.observeAutomationProgress(Date.now());
  }, AUTOMATION_PROGRESS_CHECK_INTERVAL_MS);

  window.__WAR_ON_BOARD_DEBUG__ = {
    async startMatch(options) {
      MatchService.startMatch(options);
      await goto(resolve("/game"));
    },
    getStatus() {
      const automation = MatchControlRepository.get().automation;
      const winner = TurnRepository.get().winner;

      return {
        winner: winner === null ? null : String(winner),
        automationStatus: automation.status,
        stopReason: automation.stopReason,
        reportCount: DebugModeRepository.getReportCount(),
      };
    },
    getReports: () => DebugModeRepository.getReports(),
    getViolationTypeLabel: violationTypeLabel,
  };

  return () => {
    window.removeEventListener("error", handleError);
    window.removeEventListener("unhandledrejection", handleRejection);
    window.clearInterval(progressTimer);
    delete window.__WAR_ON_BOARD_DEBUG__;
    DebugModeService.setChecksEnabled(false);
  };
}
