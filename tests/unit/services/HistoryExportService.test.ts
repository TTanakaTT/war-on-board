import { beforeEach, describe, expect, test } from "vitest";
import { GameApi } from "$lib/api/GameApi";
import { MatchControlRepository } from "$lib/data/repositories/MatchControlRepository";
import { AiStrength } from "$lib/domain/enums/AiStrength";
import { Player } from "$lib/domain/enums/Player";
import { HistoryExportService } from "$lib/services/HistoryExportService";

describe("HistoryExportService", () => {
  beforeEach(() => {
    GameApi.initializeGame({ layer: 4 });
    MatchControlRepository.set({
      mode: "cpu-vs-cpu",
      controllers: {
        self: "cpu",
        opponent: "cpu",
      },
      aiStrengths: {
        self: AiStrength.STRENGTH_2,
        opponent: AiStrength.STRENGTH_2,
      },
      automation: {
        status: "idle",
        automatedTurns: 0,
        turnLimit: 10,
        stopReason: null,
        stoppedAtWinner: null,
      },
    });
  });

  test("serializes normalized history metadata and entries without altering repository state", () => {
    const endTurnResult = GameApi.endTurn(Player.SELF);
    expect(endTurnResult.ok).toBe(true);

    const historyBeforeExport = GameApi.getGameStateHistory();
    const exportedJson = HistoryExportService.toJson();
    const parsedHistory = JSON.parse(exportedJson);
    const historyAfterExport = GameApi.getGameStateHistory();

    expect(parsedHistory).toEqual({
      metadata: {
        winner: null,
        layer: 4,
        homeBases: historyBeforeExport[0].snapshot.homeBases,
        players: {
          self: {
            player: "self",
            seatLabel: "First Player",
            displayName: "AI 1 Lv.2",
          },
          opponent: {
            player: "opponent",
            seatLabel: "Second Player",
            displayName: "AI 2 Lv.2",
          },
        },
      },
      entries: [
        {
          capturedAtTurn: 1,
          turnPlayer: "self",
          unitTotals: { self: 0, opponent: 0 },
          resources: { self: 10, opponent: 5 },
          wallTotals: { self: 10, opponent: 10 },
          occupiedPanels: { self: 1, opponent: 1 },
        },
        {
          capturedAtTurn: 1,
          turnPlayer: "opponent",
          unitTotals: { self: 0, opponent: 0 },
          resources: { self: 10, opponent: 10 },
          wallTotals: { self: 10, opponent: 10 },
          occupiedPanels: { self: 1, opponent: 1 },
        },
      ],
    });
    expect(historyAfterExport).toEqual(historyBeforeExport);
  });
});
