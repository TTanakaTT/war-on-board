import { beforeEach, describe, test, expect } from "vitest";
import { GameApi } from "$lib/api/GameApi";
import { VictoryService } from "$lib/services/VictoryService";
import { PanelRepository } from "$lib/data/repositories/PanelRepository";
import { TurnRepository } from "$lib/data/repositories/TurnRepository";
import { HomeBaseRepository } from "$lib/data/repositories/HomeBaseRepository";
import { Panel } from "$lib/domain/entities/Panel";
import { PanelState } from "$lib/domain/enums/PanelState";
import { Player } from "$lib/domain/enums/Player";

describe("VictoryService", () => {
  beforeEach(() => {
    GameApi.initializeGame({ layer: 4 });
  });

  describe("checkVictory", () => {
    test("returns null when no home base is captured", () => {
      expect(VictoryService.checkVictory()).toBeNull();
    });

    test("returns Player.SELF when SELF captures OPPONENT home base", () => {
      const opponentHB = HomeBaseRepository.getByPlayer(Player.OPPONENT)!;
      const panel = PanelRepository.find(opponentHB.panelPosition)!;
      PanelRepository.update(
        new Panel({
          ...panel,
          player: Player.SELF,
          panelState: PanelState.OCCUPIED,
        }),
      );
      expect(VictoryService.checkVictory()).toBe(Player.SELF);
    });

    test("returns Player.OPPONENT when OPPONENT captures SELF home base", () => {
      const selfHB = HomeBaseRepository.getByPlayer(Player.SELF)!;
      const panel = PanelRepository.find(selfHB.panelPosition)!;
      PanelRepository.update(
        new Panel({
          ...panel,
          player: Player.OPPONENT,
          panelState: PanelState.OCCUPIED,
        }),
      );
      expect(VictoryService.checkVictory()).toBe(Player.OPPONENT);
    });

    test("returns null when home base panel is owned by Player.UNKNOWN", () => {
      const selfHB = HomeBaseRepository.getByPlayer(Player.SELF)!;
      const panel = PanelRepository.find(selfHB.panelPosition)!;
      PanelRepository.update(
        new Panel({
          ...panel,
          player: Player.UNKNOWN,
          panelState: PanelState.UNOCCUPIED,
        }),
      );
      expect(VictoryService.checkVictory()).toBeNull();
    });
  });

  describe("applyVictory", () => {
    test("sets winner in TurnRepository when a home base is captured", () => {
      const opponentHB = HomeBaseRepository.getByPlayer(Player.OPPONENT)!;
      const panel = PanelRepository.find(opponentHB.panelPosition)!;
      PanelRepository.update(
        new Panel({
          ...panel,
          player: Player.SELF,
          panelState: PanelState.OCCUPIED,
        }),
      );
      VictoryService.applyVictory();
      expect(TurnRepository.get().winner).toBe(Player.SELF);
    });

    test("does not change turn when no victory detected", () => {
      const turnBefore = TurnRepository.get();
      VictoryService.applyVictory();
      expect(TurnRepository.get().winner).toBe(turnBefore.winner);
    });
  });
});
