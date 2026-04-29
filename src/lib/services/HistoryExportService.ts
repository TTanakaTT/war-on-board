import { GameApi } from "$lib/api/GameApi";
import type { GameStateHistoryEntry } from "$lib/domain/types/api";

export class HistoryExportService {
  static getHistoryEntries(): GameStateHistoryEntry[] {
    return GameApi.getGameStateHistory();
  }

  static toJson(): string {
    return JSON.stringify(this.getHistoryEntries(), null, 2);
  }
}
