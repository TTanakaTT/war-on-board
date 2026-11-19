import type {
  AiStrength,
  GameState,
  HomeBase,
  PieceType,
  Player,
  Side,
} from "#lib/domain/model.ts";

export type PlayerController = "human" | "cpu";
export type AutomationStatus = "idle" | "running" | "stopped";
export type AutomationStopReason = "turn-limit" | "winner" | null;

export type BySide<T> = Record<Side, T>;

export interface MatchAutomationState {
  status: AutomationStatus;
  automatedTurns: number;
  turnLimit: number;
  stopReason: AutomationStopReason;
  stoppedAtWinner: Player | null;
}

export interface MatchControl {
  controllers: BySide<PlayerController>;
  aiStrengths: BySide<AiStrength>;
  /** Seeds of each side's CPU random source (unused for humans). */
  aiSeeds: BySide<number>;
  automation: MatchAutomationState;
}

export interface StartMatchOptions {
  controllers: BySide<PlayerController>;
  layer: number;
  automationTurnLimit: number;
  aiStrengths: BySide<AiStrength>;
  /** Replays CPU choices; new seeds are created when omitted. */
  aiSeeds?: BySide<number>;
}

export interface PlayerMatchStats {
  totalProducedResources: number;
  totalBuiltCastle: number;
  deadUnitCounts: Record<PieceType, number>;
}

export type MatchStats = BySide<PlayerMatchStats>;

export interface MatchHistoryExport {
  metadata: {
    winner: Player | null;
    layer: number;
    homeBases: HomeBase[];
    players: BySide<{
      player: Side;
      controller: PlayerController;
      aiStrength: AiStrength;
      aiSeed: number;
    }>;
  };
  entries: {
    capturedAtTurn: number;
    turnPlayer: Player;
    unitTotals: BySide<number>;
    resources: BySide<number>;
    wallTotals: BySide<number>;
    occupiedPanels: BySide<number>;
  }[];
}

export type InvariantViolationType =
  | "piece-capacity-exceeded"
  | "mixed-players-on-panel"
  | "piece-hp-out-of-range"
  | "movement-points-out-of-range"
  | "duplicate-piece-id"
  | "piece-off-board"
  | "unmerged-pieces"
  | "negative-resources"
  | "state-changed-after-winner"
  | "uncaught-exception"
  | "ai-stalled";

export interface InvariantViolation {
  type: InvariantViolationType;
  /** Type plus subject; a key already present before a command was not introduced by it. */
  key: string;
  detail: string;
}

export interface RecordedCommand {
  operation: string;
  args: unknown[];
}

export interface InvariantViolationReport {
  violations: InvariantViolation[];
  match: Pick<MatchControl, "controllers" | "aiStrengths" | "aiSeeds"> & { layer: number };
  /** null for runtime violations (exceptions, stalls). */
  command: RecordedCommand | null;
  /** Commands since the turn began, ending with `command`. */
  turnCommands: RecordedCommand[];
  before: GameState | null;
  after: GameState;
}
