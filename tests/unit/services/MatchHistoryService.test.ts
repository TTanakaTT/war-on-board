import { describe, expect, test } from "vitest";
import { GameApi } from "#lib/api/GameApi.ts";
import { AiStrength, Player } from "#lib/domain/model.ts";
import { MatchHistoryService } from "#lib/services/MatchHistoryService.ts";
import { MatchControlRepository } from "#lib/store.svelte.ts";
import { add, newGame, pos } from "../helpers.ts";

describe("MatchHistoryService", () => {
  test("exports metadata and per-entry totals (merged pieces count their stack)", () => {
    newGame(4);
    MatchControlRepository.set({
      ...MatchControlRepository.get(),
      controllers: { self: "cpu", opponent: "human" },
      aiStrengths: { self: AiStrength.STRENGTH_2, opponent: AiStrength.STRENGTH_1 },
      aiSeeds: { self: 1, opponent: 2 },
    });
    add(1, pos(0, 0), Player.SELF, { stackCount: 3 });
    GameApi.endTurn(Player.SELF);

    const exported = JSON.parse(MatchHistoryService.toJson());
    expect(exported.metadata).toMatchObject({
      winner: null,
      layer: 4,
      players: { self: { controller: "cpu", aiStrength: AiStrength.STRENGTH_2, aiSeed: 1 } },
    });
    expect(exported.entries[1]).toEqual({
      capturedAtTurn: 1,
      turnPlayer: "opponent",
      unitTotals: { self: 3, opponent: 0 },
      resources: { self: 10, opponent: 10 },
      wallTotals: { self: 10, opponent: 10 },
      occupiedPanels: { self: 2, opponent: 1 },
    });
  });
});
