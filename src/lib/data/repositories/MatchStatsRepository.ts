import { matchStatsState } from "$lib/data/state/MatchStatsState.svelte";
import type { PieceType } from "$lib/domain/enums/PieceType";
import { Player } from "$lib/domain/enums/Player";
import type {
  MatchStats,
  MatchStatsPieceKey,
  MatchStatsPlayerKey,
  PieceTypeMatchStats,
  PlayerMatchStats,
} from "$lib/domain/types/matchStats";

export class MatchStatsRepository {
  static get(): MatchStats {
    const matchStats = matchStatsState.get();

    return {
      self: this.clonePlayerStats(matchStats.self),
      opponent: this.clonePlayerStats(matchStats.opponent),
    };
  }

  static set(matchStats: MatchStats): void {
    matchStatsState.set({
      self: this.clonePlayerStats(matchStats.self),
      opponent: this.clonePlayerStats(matchStats.opponent),
    });
  }

  static reset(): void {
    matchStatsState.reset();
  }

  static addProducedResources(player: Player, amount: number): void {
    if (amount <= 0) {
      return;
    }

    const matchStats = this.get();
    const playerKey = this.toPlayerKey(player);

    this.set({
      ...matchStats,
      [playerKey]: {
        ...matchStats[playerKey],
        totalProducedResources: matchStats[playerKey].totalProducedResources + amount,
      },
    });
  }

  static addBuiltCastle(player: Player, amount: number): void {
    if (amount <= 0) {
      return;
    }

    const matchStats = this.get();
    const playerKey = this.toPlayerKey(player);

    this.set({
      ...matchStats,
      [playerKey]: {
        ...matchStats[playerKey],
        totalBuiltCastle: matchStats[playerKey].totalBuiltCastle + amount,
      },
    });
  }

  static addDeadUnits(player: Player, pieceType: PieceType, count: number): void {
    if (count <= 0) {
      return;
    }

    const matchStats = this.get();
    const playerKey = this.toPlayerKey(player);
    const pieceKey = this.toPieceKey(pieceType);

    this.set({
      ...matchStats,
      [playerKey]: {
        ...matchStats[playerKey],
        deadUnitCounts: {
          ...matchStats[playerKey].deadUnitCounts,
          [pieceKey]: matchStats[playerKey].deadUnitCounts[pieceKey] + count,
        },
      },
    });
  }

  private static toPlayerKey(player: Player): MatchStatsPlayerKey {
    if (player === Player.OPPONENT) {
      return "opponent";
    }

    return "self";
  }

  /** Every PieceType's string value matches its MatchStatsPieceKey field name directly. */
  private static toPieceKey(pieceType: PieceType): MatchStatsPieceKey {
    return String(pieceType) as MatchStatsPieceKey;
  }

  private static clonePlayerStats(playerStats: PlayerMatchStats): PlayerMatchStats {
    return {
      totalProducedResources: playerStats.totalProducedResources,
      totalBuiltCastle: playerStats.totalBuiltCastle,
      deadUnitCounts: this.clonePieceTypeStats(playerStats.deadUnitCounts),
    };
  }

  private static clonePieceTypeStats(pieceTypeStats: PieceTypeMatchStats): PieceTypeMatchStats {
    return {
      infantry: pieceTypeStats.infantry,
      rook: pieceTypeStats.rook,
      noble: pieceTypeStats.noble,
      archer: pieceTypeStats.archer,
      cavalry: pieceTypeStats.cavalry,
      heavy: pieceTypeStats.heavy,
      siege: pieceTypeStats.siege,
    };
  }
}
