import { beforeEach, describe, expect, test } from "vitest";
import { GameApi } from "$lib/api/GameApi";
import { Player } from "$lib/domain/enums/Player";
import { HistoryExportService } from "$lib/services/HistoryExportService";

describe("HistoryExportService", () => {
  beforeEach(() => {
    GameApi.initializeGame({ layer: 4 });
  });

  test("serializes the recorded history as parseable JSON without altering repository state", () => {
    const endTurnResult = GameApi.endTurn(Player.SELF);
    expect(endTurnResult.ok).toBe(true);

    const historyBeforeExport = GameApi.getGameStateHistory();
    const exportedJson = HistoryExportService.toJson();
    const parsedHistory = JSON.parse(exportedJson);
    const historyAfterExport = GameApi.getGameStateHistory();

    expect(parsedHistory).toEqual(historyBeforeExport);
    expect(historyAfterExport).toEqual(historyBeforeExport);
  });
});
