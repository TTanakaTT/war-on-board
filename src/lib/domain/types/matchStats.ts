export interface PieceTypeMatchStats {
  infantry: number;
  rook: number;
  noble: number;
  archer: number;
  cavalry: number;
  heavy: number;
  siege: number;
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
