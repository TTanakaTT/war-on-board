import { beforeEach, describe, expect, test } from "vitest";
import { GameApi } from "#lib/api/GameApi.ts";
import { MatchControlRepository } from "#lib/store.svelte.ts";
import { AiStrength, Player } from "#lib/domain/model.ts";
import { MatchHistoryService } from "#lib/services/MatchHistoryService.ts";

describe("HistoryExportService", () => {
  beforeEach(() => {
    GameApi.initializeGame({ layer: 4 });
    MatchControlRepository.set({
      controllers: {
        self: "cpu",
        opponent: "cpu",
      },
      aiStrengths: {
        self: AiStrength.STRENGTH_2,
        opponent: AiStrength.STRENGTH_2,
      },
      aiSeeds: {
        self: 12345,
        opponent: 67890,
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
    const exportedJson = MatchHistoryService.toJson();
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
            controller: "cpu",
            aiStrength: AiStrength.STRENGTH_2,
            aiSeed: 12345,
          },
          opponent: {
            player: "opponent",
            controller: "cpu",
            aiStrength: AiStrength.STRENGTH_2,
            aiSeed: 67890,
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
