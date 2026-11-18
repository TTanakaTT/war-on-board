import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GameApi } from "#lib/api/GameApi.ts";
import type { GameStateHistoryEntry, Piece } from "#lib/domain/model.ts";
import { MatchHistoryService } from "#lib/services/MatchHistoryService.ts";

describe("MatchHistoryService", () => {
  beforeEach(() => {
    GameApi.initializeGame({ layer: 4 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("counts a merged piece as its stackCount in unitTotals", () => {
    const [initialEntry] = GameApi.getGameStateHistory();
    const panelPosition = { horizontalLayer: 0, verticalLayer: 0 };
    const mergedPiece: Piece = {
      id: 1,
      panelPosition,
      initialPosition: panelPosition,
      player: "self",
      pieceType: "infantry",
      hp: 30,
      stackCount: 3,
      maxHp: 30,
      movementPoints: 0,
    };
    const entry: GameStateHistoryEntry = {
      ...initialEntry,
      snapshot: { ...initialEntry.snapshot, pieces: [mergedPiece] },
    };
    vi.spyOn(GameApi, "getGameStateHistory").mockReturnValue([entry]);

    const [summary] = MatchHistoryService.getExportData().entries;

    expect(summary.unitTotals).toEqual({ self: 3, opponent: 0 });
  });
});
