import { GameApi } from "#lib/api/GameApi.ts";
import { MatchControlRepository } from "#lib/data/repositories/MatchControlRepository.ts";
import type {
  ControllablePlayerSnapshot,
  GameStateHistoryEntry,
  GameStateSnapshot,
} from "#lib/domain/types/api.ts";
import type {
  MatchHistoryEntrySummary,
  MatchHistoryExport,
  MatchHistoryMetadata,
  MatchHistoryMetricPair,
  MatchHistoryPlayerSummary,
} from "#lib/domain/types/history.ts";
import type { MatchAiSeeds, MatchAiStrengths, MatchControllers } from "#lib/domain/types/match.ts";

const CONTROLLABLE_PLAYERS = [
  "self",
  "opponent",
] as const satisfies readonly ControllablePlayerSnapshot[];

export class MatchHistoryService {
  static getExportData(): MatchHistoryExport {
    const historyEntries = GameApi.getGameStateHistory();
    const matchControl = MatchControlRepository.get();

    return {
      metadata: this.buildMetadata(
        historyEntries,
        matchControl.controllers,
        matchControl.aiStrengths,
        matchControl.aiSeeds,
      ),
      entries: historyEntries.map((entry) => this.buildEntrySummary(entry)),
    };
  }

  private static buildMetadata(
    historyEntries: GameStateHistoryEntry[],
    controllers: MatchControllers,
    aiStrengths: MatchAiStrengths,
    aiSeeds: MatchAiSeeds,
  ): MatchHistoryMetadata {
    const latestSnapshot = historyEntries.at(-1)?.snapshot;

    return {
      winner: latestSnapshot?.turn.winner ?? null,
      layer: latestSnapshot?.layer ?? 0,
      homeBases: latestSnapshot?.homeBases ?? [],
      players: {
        self: this.buildPlayerSummary("self", controllers, aiStrengths, aiSeeds),
        opponent: this.buildPlayerSummary("opponent", controllers, aiStrengths, aiSeeds),
      },
    };
  }

  private static buildPlayerSummary(
    player: ControllablePlayerSnapshot,
    controllers: MatchControllers,
    aiStrengths: MatchAiStrengths,
    aiSeeds: MatchAiSeeds,
  ): MatchHistoryPlayerSummary {
    return {
      player,
      controller: controllers[player],
      aiStrength: aiStrengths[player],
      aiSeed: aiSeeds[player],
    };
  }

  private static buildEntrySummary(entry: GameStateHistoryEntry): MatchHistoryEntrySummary {
    const turnPlayer = entry.snapshot.turn.player;

    return {
      capturedAtTurn: entry.capturedAtTurn,
      turnPlayer,
      unitTotals: this.countPieces(entry.snapshot),
      resources: this.readResources(entry.snapshot),
      wallTotals: this.sumOwnedPanels(entry.snapshot, (panel) => panel.castle),
      occupiedPanels: this.sumOwnedPanels(entry.snapshot, () => 1),
    };
  }

  private static countPieces(snapshot: GameStateSnapshot): MatchHistoryMetricPair {
    return {
      self: snapshot.pieces.filter((piece) => piece.player === "self").length,
      opponent: snapshot.pieces.filter((piece) => piece.player === "opponent").length,
    };
  }

  private static readResources(snapshot: GameStateSnapshot): MatchHistoryMetricPair {
    return {
      self: snapshot.turn.resources.self ?? 0,
      opponent: snapshot.turn.resources.opponent ?? 0,
    };
  }

  private static sumOwnedPanels(
    snapshot: GameStateSnapshot,
    readValue: (panel: GameStateSnapshot["panels"][number]) => number,
  ): MatchHistoryMetricPair {
    return CONTROLLABLE_PLAYERS.reduce<MatchHistoryMetricPair>(
      (totals, player) => ({
        ...totals,
        [player]: snapshot.panels
          .filter((panel) => panel.player === player)
          .reduce((sum, panel) => sum + readValue(panel), 0),
      }),
      { self: 0, opponent: 0 },
    );
  }
}
