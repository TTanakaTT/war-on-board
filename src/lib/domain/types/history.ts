import type { HomeBaseSnapshot, ControllablePlayerSnapshot } from "$lib/domain/types/api";

export interface MatchHistoryMetricPair {
  self: number;
  opponent: number;
}

export interface MatchHistoryPlayerSummary {
  player: ControllablePlayerSnapshot;
  seatLabel: string;
  displayName: string;
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
