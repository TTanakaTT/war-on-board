import { matchStatsState } from "$lib/data/state/MatchStatsState.svelte";
import { PieceType } from "$lib/domain/enums/PieceType";
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

  private static toPieceKey(pieceType: PieceType): MatchStatsPieceKey {
    if (pieceType === PieceType.ROOK) {
      return "rook";
    }

    if (pieceType === PieceType.BISHOP) {
      return "bishop";
    }

    return "knight";
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
      knight: pieceTypeStats.knight,
      rook: pieceTypeStats.rook,
      bishop: pieceTypeStats.bishop,
    };
  }
}
