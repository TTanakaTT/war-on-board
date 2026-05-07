import type { AiStrength } from "$lib/domain/enums/AiStrength";
import type { HomeBaseSnapshot, ControllablePlayerSnapshot } from "$lib/domain/types/api";
import type { PlayerController } from "$lib/domain/types/match";

export interface MatchHistoryMetricPair {
  self: number;
  opponent: number;
}

export interface MatchHistoryPlayerSummary {
  player: ControllablePlayerSnapshot;
  controller: PlayerController;
  aiStrength: AiStrength;
}

export interface MatchHistoryMetadata {
  winner: ControllablePlayerSnapshot | null;
  layer: number;
  homeBases: HomeBaseSnapshot[];
  players: Record<ControllablePlayerSnapshot, MatchHistoryPlayerSummary>;
}

export interface MatchHistoryEntrySummary {
  capturedAtTurn: number;
  turnPlayer: ControllablePlayerSnapshot;
  unitTotals: MatchHistoryMetricPair;
  resources: MatchHistoryMetricPair;
  wallTotals: MatchHistoryMetricPair;
  occupiedPanels: MatchHistoryMetricPair;
}

export interface MatchHistoryExport {
  metadata: MatchHistoryMetadata;
  entries: MatchHistoryEntrySummary[];
}
