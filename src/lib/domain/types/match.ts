import type { AiStrength } from "$lib/domain/enums/AiStrength";
import type { Player } from "$lib/domain/enums/Player";

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
  automation: MatchAutomationState;
}

export interface StartMatchOptions {
  controllers: MatchControllers;
  layer: number;
  automationTurnLimit: number;
  aiStrengths: MatchAiStrengths;
}
