import { describe, expect, test } from "vitest";
import { GameApi } from "#lib/api/GameApi.ts";
import { AiStrength, opponentOf, PieceType, pos } from "#lib/domain/model.ts";
import { MatchHistoryService } from "#lib/services/MatchHistoryService.ts";
import { MatchControlRepository, MatchStatsRepository } from "#lib/store.svelte.ts";
import { add, newGame, SIDES } from "../helpers.ts";

describe.each(SIDES)("MatchHistoryService (%s)", (player) => {
  test("exports metadata and per-entry totals for each side", () => {
    const enemy = opponentOf(player);
    newGame(4, player);
    MatchControlRepository.set({
      ...MatchControlRepository.get(),
      controllers: { [player]: "cpu", [enemy]: "human" } as never,
      aiStrengths: { [player]: AiStrength.STRENGTH_2, [enemy]: AiStrength.STRENGTH_1 } as never,
      aiSeeds: { [player]: 1, [enemy]: 2 } as never,
    });
    add(1, pos(0, 0), player, { stackCount: 3 });
    MatchStatsRepository.addLostUnits(enemy, PieceType.INFANTRY, 2);
    MatchStatsRepository.addGainedResources(player, 7);
    MatchStatsRepository.addBuiltWall(enemy, 4);
    GameApi.endTurn(player);
    const stats = MatchStatsRepository.get();
    const snapshot = GameApi.getGameStateHistory()[1].snapshot;

    const exported = JSON.parse(MatchHistoryService.toJson());
    expect(exported.metadata).toMatchObject({
      winner: null,
      layer: 4,
      players: { [player]: { controller: "cpu", aiStrength: AiStrength.STRENGTH_2, aiSeed: 1 } },
    });
    const entry = exported.entries[1];
    expect(entry).not.toHaveProperty("unitTotals");
    expect(entry).toEqual({
      capturedAtTurn: snapshot.turn.num,
      turnPlayer: enemy,
      resources: snapshot.turn.resources,
      totalGainedResources: {
        [player]: stats[player].totalGainedResources,
        [enemy]: stats[enemy].totalGainedResources,
      },
      totalWall: { [player]: 10, [enemy]: 10 },
      totalBuiltWall: {
        [player]: stats[player].totalBuiltWall,
        [enemy]: stats[enemy].totalBuiltWall,
      },
      occupiedPanels: { [player]: 2, [enemy]: 1 },
      armyPower: { [player]: 24, [enemy]: 0 },
      lostArmyPower: { [player]: 0, [enemy]: 16 },
    });
    expect(entry.totalGainedResources[player]).not.toBe(entry.totalGainedResources[enemy]);
    expect(entry.totalBuiltWall[player]).not.toBe(entry.totalBuiltWall[enemy]);
  });
});
