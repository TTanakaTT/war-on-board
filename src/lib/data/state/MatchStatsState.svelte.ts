import { HOME_BASE_INIT_CASTLE, PLAYER_INIT_RESOURCE } from "$lib/domain/constants/GameConstants";
import type { MatchStats } from "$lib/domain/types/matchStats";

function createInitialMatchStats(): MatchStats {
  return {
    self: {
      totalProducedResources: PLAYER_INIT_RESOURCE,
      totalBuiltCastle: HOME_BASE_INIT_CASTLE,
      deadUnitCounts: {
        knight: 0,
        rook: 0,
        bishop: 0,
      },
    },
    opponent: {
      totalProducedResources: PLAYER_INIT_RESOURCE,
      totalBuiltCastle: HOME_BASE_INIT_CASTLE,
      deadUnitCounts: {
        knight: 0,
        rook: 0,
        bishop: 0,
      },
    },
  };
}

let _matchStats = $state<MatchStats>(createInitialMatchStats());

function get(): MatchStats {
  return _matchStats;
}

function set(matchStats: MatchStats): void {
  _matchStats = matchStats;
}

function reset(): void {
  _matchStats = createInitialMatchStats();
}

export const matchStatsState = {
  get,
  set,
  reset,
};
