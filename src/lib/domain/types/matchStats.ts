export interface PieceTypeMatchStats {
  knight: number;
  rook: number;
  bishop: number;
}

export interface PlayerMatchStats {
  totalProducedResources: number;
  totalBuiltCastle: number;
  deadUnitCounts: PieceTypeMatchStats;
}

export interface MatchStats {
  self: PlayerMatchStats;
  opponent: PlayerMatchStats;
}

export type MatchStatsPlayerKey = keyof MatchStats;
export type MatchStatsPieceKey = keyof PieceTypeMatchStats;
