import { GameApi } from "$lib/api/GameApi";
import { MatchControlRepository } from "$lib/data/repositories/MatchControlRepository";
import type {
  ControllablePlayerSnapshot,
  GameStateHistoryEntry,
  GameStateSnapshot,
} from "$lib/domain/types/api";
import type {
  MatchHistoryEntrySummary,
  MatchHistoryExport,
  MatchHistoryMetadata,
  MatchHistoryMetricPair,
  MatchHistoryPlayerSummary,
} from "$lib/domain/types/history";
import type { MatchAiStrengths, MatchControllers } from "$lib/domain/types/match";
import { playerDisplayNames, seatLabel } from "$lib/presentation/matchPresentation";

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
      ),
      entries: historyEntries.map((entry) => this.buildEntrySummary(entry)),
    };
  }

  private static buildMetadata(
    historyEntries: GameStateHistoryEntry[],
    controllers: MatchControllers,
    aiStrengths: MatchAiStrengths,
  ): MatchHistoryMetadata {
    const latestSnapshot = historyEntries.at(-1)?.snapshot;
    const displayNames = playerDisplayNames(controllers, aiStrengths);

    return {
      winner: latestSnapshot?.turn.winner ?? null,
      layer: latestSnapshot?.layer ?? 0,
      homeBases: latestSnapshot?.homeBases ?? [],
      players: {
        self: this.buildPlayerSummary("self", displayNames.self),
        opponent: this.buildPlayerSummary("opponent", displayNames.opponent),
      },
    };
  }

  private static buildPlayerSummary(
    player: ControllablePlayerSnapshot,
    displayName: string,
  ): MatchHistoryPlayerSummary {
    return {
      player,
      seatLabel: seatLabel(player),
      displayName,
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
