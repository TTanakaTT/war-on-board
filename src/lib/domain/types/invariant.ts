import type { GameStateSnapshot } from "$lib/domain/types/api";
import type { MatchAiStrengths, MatchControllers } from "$lib/domain/types/match";

/** Board-state invariants checked by InvariantService against a single snapshot. */
export type StateInvariantViolationType =
  | "piece-capacity-exceeded"
  | "mixed-players-on-panel"
  | "piece-hp-out-of-range"
  | "movement-points-out-of-range"
  | "duplicate-piece-id"
  | "piece-off-board"
  | "unmerged-pieces"
  | "negative-resources";

/** Invariants that need the state before and after a command. */
export type TransitionInvariantViolationType = "state-changed-after-winner";

/** Problems observed while the game runs, outside any single command. */
export type RuntimeInvariantViolationType = "uncaught-exception" | "ai-stalled";

export type InvariantViolationType =
  StateInvariantViolationType | TransitionInvariantViolationType | RuntimeInvariantViolationType;

export interface InvariantViolation {
  type: InvariantViolationType;
  /**
   * Stable identity of the violation (type plus the panel, piece, or player it is about).
   * A violation whose key already existed before a command was not introduced by that command.
   */
  key: string;
  /** Technical description for logs and issues. Never shown on screen. */
  detail: string;
}

/** A command as it went through GameApiClient, with arguments serialized to plain JSON values. */
export interface RecordedCommand {
  operation: string;
  args: unknown[];
}

export interface InvariantMatchConditions {
  layer: number;
  controllers: MatchControllers;
  aiStrengths: MatchAiStrengths;
}

/** Everything needed to reproduce and investigate one detection. */
export interface InvariantViolationReport {
  /** Violations newly introduced at this point, all detected at the same time. */
  violations: InvariantViolation[];
  match: InvariantMatchConditions;
  /** The command that introduced the violations, or null for runtime violations. */
  command: RecordedCommand | null;
  /** Commands issued since the current turn began, ending with `command` when there is one. */
  turnCommands: RecordedCommand[];
  /** State right before `command`, or null for runtime violations. */
  before: GameStateSnapshot | null;
  /** State when the violations were detected. */
  after: GameStateSnapshot;
}
