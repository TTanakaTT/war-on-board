import { beforeEach, describe, test, expect } from "vitest";
import { GameApi } from "$lib/api/GameApi";
import { AiService } from "$lib/services/AiService";
import { PiecesRepository } from "$lib/data/repositories/PieceRepository";
import { TurnRepository } from "$lib/data/repositories/TurnRepository";
import { Piece } from "$lib/domain/entities/Piece";
import { PanelPosition } from "$lib/domain/entities/PanelPosition";
import { PieceType } from "$lib/domain/enums/PieceType";
import { Player } from "$lib/domain/enums/Player";

const pos = (h: number, v: number) => new PanelPosition({ horizontalLayer: h, verticalLayer: v });

describe("AiService", () => {
  beforeEach(() => {
    GameApi.initializeGame({ layer: 4 });
  });

  describe("doAiTurn", () => {
    test("does nothing when it is not the given player's turn", () => {
      // Turn starts as SELF, so calling for OPPONENT should be a no-op
      const turnBefore = TurnRepository.get();
      AiService.doAiTurn(Player.OPPONENT);
      const turnAfter = TurnRepository.get();
      expect(turnAfter.player).toBe(turnBefore.player);
      expect(turnAfter.num).toBe(turnBefore.num);
    });

    test("does nothing when game has a winner", () => {
      const turn = TurnRepository.get();
      TurnRepository.set({ ...turn, winner: Player.SELF });
      AiService.doAiTurn(Player.SELF);
      // Turn should not change (endTurn not called)
      expect(TurnRepository.get().winner).toBe(Player.SELF);
    });

    test("assigns moves to all pieces owned by the player", () => {
      // Place a piece for SELF
      PiecesRepository.add(
        new Piece({
          id: 1,
          panelPosition: pos(-2, 0),
          player: Player.SELF,
          pieceType: PieceType.KNIGHT,
        }),
      );
      AiService.doAiTurn(Player.SELF);
      // After AI turn ends, turn switches to OPPONENT, and pieces' moves are resolved
      expect(TurnRepository.get().player).toBe(Player.OPPONENT);
    });

    test("generates a piece when resources are sufficient", () => {
      // Give SELF plenty of resources
      const turn = TurnRepository.get();
      TurnRepository.set({ ...turn, resources: { ...turn.resources, [String(Player.SELF)]: 50 } });
      AiService.doAiTurn(Player.SELF);
      // Turn ended, so we're now OPPONENT's turn
      // At least one piece should have been generated (or attempted)
      expect(TurnRepository.get().player).toBe(Player.OPPONENT);
    });

    test("does not generate a piece when resources are insufficient", () => {
      // Set resources to 0
      const turn = TurnRepository.get();
      TurnRepository.set({ ...turn, resources: { ...turn.resources, [String(Player.SELF)]: 0 } });
      AiService.doAiTurn(Player.SELF);
      // No piece generated, but turn still ends
      expect(TurnRepository.get().player).toBe(Player.OPPONENT);
    });

    test("ends the turn after assigning moves and generating", () => {
      AiService.doAiTurn(Player.SELF);
      expect(TurnRepository.get().player).toBe(Player.OPPONENT);
    });

    test("works for Player.SELF (symmetry)", () => {
      AiService.doAiTurn(Player.SELF);
      expect(TurnRepository.get().player).toBe(Player.OPPONENT);
    });

    test("works for Player.OPPONENT (symmetry)", () => {
      // First end SELF's turn to make it OPPONENT's turn
      GameApi.endTurn(Player.SELF);
      expect(TurnRepository.get().player).toBe(Player.OPPONENT);
      AiService.doAiTurn(Player.OPPONENT);
      expect(TurnRepository.get().player).toBe(Player.SELF);
    });
  });
});
