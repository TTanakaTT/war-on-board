import type { Player } from "$lib/domain/enums/Player";

export type MatchMode = "human-vs-cpu" | "cpu-vs-cpu";

export type PlayerController = "human" | "cpu";

export type AutomationStatus = "idle" | "running" | "stopped";

export type AutomationStopReason = "turn-limit" | "winner" | null;

export interface MatchControllers {
  self: PlayerController;
  opponent: PlayerController;
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
  automation: MatchAutomationState;
}

export interface StartMatchOptions {
  layer: number;
  automationTurnLimit: number;
}
