import type { MatchHistoryExport } from "$lib/domain/types/history";
import { MatchHistoryService } from "$lib/services/MatchHistoryService";

export class HistoryExportService {
  static getExportData(): MatchHistoryExport {
    return MatchHistoryService.getExportData();
  }

  static toJson(): string {
    return JSON.stringify(this.getExportData(), null, 2);
  }
}
