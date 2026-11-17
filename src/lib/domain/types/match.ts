import type { AiStrength } from "#lib/domain/enums/AiStrength.ts";
import type { Player } from "#lib/domain/enums/Player.ts";

export type MatchMode = "human-vs-human" | "human-vs-cpu" | "cpu-vs-human" | "cpu-vs-cpu";

export type PlayerController = "human" | "cpu";

export type AutomationStatus = "idle" | "running" | "stopped";

export type AutomationStopReason = "turn-limit" | "winner" | null;

export interface MatchControllers {
  self: PlayerController;
  opponent: PlayerController;
}

export interface MatchAiStrengths {
  self: AiStrength;
  opponent: AiStrength;
}

/** Seeds of each player's CPU random source. Human players get one too; it is just unused. */
export interface MatchAiSeeds {
  self: number;
  opponent: number;
}

export interface MatchAutomationState {
  status: AutomationStatus;
  automatedTurns: number;
  turnLimit: number;
  stopReason: AutomationStopReason;
  stoppedAtWinner: Player | null;
}

export interface MatchControl {
  mode: MatchMode;
  controllers: MatchControllers;
  aiStrengths: MatchAiStrengths;
  aiSeeds: MatchAiSeeds;
  automation: MatchAutomationState;
}

export interface StartMatchOptions {
  controllers: MatchControllers;
  layer: number;
  automationTurnLimit: number;
  aiStrengths: MatchAiStrengths;
  /** Replays CPU choices from the start of the match; new seeds are created when omitted. */
  aiSeeds?: MatchAiSeeds;
}
