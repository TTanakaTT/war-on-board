import { GameApi } from "#lib/api/GameApi.ts";
import {
  armyPower,
  lostCombatUnitCounts,
  liveCombatUnitCounts,
  type GameState,
  type Panel,
  type Side,
} from "#lib/domain/model.ts";
import type { BySide, MatchHistoryExport } from "#lib/domain/types.ts";
import { MatchControlRepository } from "#lib/store.svelte.ts";

const bySide = (value: (side: Side) => number): BySide<number> => ({
  self: value("self"),
  opponent: value("opponent"),
});

export class MatchHistoryService {
  static getExportData(): MatchHistoryExport {
    const history = GameApi.getGameStateHistory();
    const { controllers, aiStrengths, aiSeeds } = MatchControlRepository.get();
    const latest = history.at(-1)?.snapshot;
    const player = (side: Side) => ({
      player: side,
      controller: controllers[side],
      aiStrength: aiStrengths[side],
      aiSeed: aiSeeds[side],
    });

    return {
      metadata: {
        winner: latest?.turn.winner ?? null,
        layer: latest?.layer ?? 0,
        homeBases: latest?.homeBases ?? [],
        players: { self: player("self"), opponent: player("opponent") },
      },
      entries: history.map(({ capturedAtTurn, snapshot, stats }) => ({
        capturedAtTurn,
        turnPlayer: snapshot.turn.player,
        resources: bySide((side) => snapshot.turn.resources[side] ?? 0),
        totalGainedResources: bySide((side) => stats[side].totalGainedResources),
        totalWall: this.sumOwnedPanels(snapshot, (panel) => panel.wall),
        totalBuiltWall: bySide((side) => stats[side].totalBuiltWall),
        occupiedPanels: this.sumOwnedPanels(snapshot, () => 1),
        armyPower: bySide((side) =>
          armyPower(liveCombatUnitCounts(snapshot.pieces.filter((p) => p.player === side))),
        ),
        lostArmyPower: bySide((side) =>
          armyPower(lostCombatUnitCounts(stats[side].lostUnitCounts)),
        ),
      })),
    };
  }

  static toJson(): string {
    return JSON.stringify(this.getExportData(), null, 2);
  }

  private static sumOwnedPanels(state: GameState, value: (panel: Panel) => number) {
    return bySide((side) =>
      state.panels.filter((p) => p.player === side).reduce((sum, p) => sum + value(p), 0),
    );
  }
}
