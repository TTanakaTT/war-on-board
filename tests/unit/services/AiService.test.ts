import { beforeEach, describe, test, expect } from "vitest";
import { GameApi } from "$lib/api/GameApi";
import { PiecesRepository } from "$lib/data/repositories/PieceRepository";
import { TurnRepository } from "$lib/data/repositories/TurnRepository";
import { Piece } from "$lib/domain/entities/Piece";
import { PanelPosition } from "$lib/domain/entities/PanelPosition";
import { AiStrength } from "$lib/domain/enums/AiStrength";
import { PieceType } from "$lib/domain/enums/PieceType";
import { Player } from "$lib/domain/enums/Player";
import { AiService } from "$lib/services/AiService";

const pos = (h: number, v: number) => new PanelPosition({ horizontalLayer: h, verticalLayer: v });

function setResources(player: Player, amount: number): void {
  const turn = TurnRepository.get();
  TurnRepository.set({ ...turn, resources: { ...turn.resources, [String(player)]: amount } });
}

function addPiece(id: number, player: Player, position: PanelPosition): void {
  PiecesRepository.add(
    new Piece({
      id,
      panelPosition: position,
      player,
      pieceType: PieceType.KNIGHT,
    }),
  );
}

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
      expect(TurnRepository.get().winner).toBe(Player.SELF);
    });

    test("advances the turn for each supported strength", () => {
      const strengths = [
        AiStrength.STRENGTH_1,
        AiStrength.STRENGTH_2,
        AiStrength.STRENGTH_3,
      ] as const;

      for (const strength of strengths) {
        GameApi.initializeGame({ layer: 4 });
        addPiece(1, Player.SELF, pos(-2, 0));
        setResources(Player.SELF, 50);

        AiService.doAiTurn(Player.SELF, strength);

        expect(TurnRepository.get().player).toBe(Player.OPPONENT);
      }
    });

    test("can act for Player.OPPONENT with strength 3", () => {
      GameApi.endTurn(Player.SELF);
      addPiece(1, Player.OPPONENT, pos(2, 0));
      setResources(Player.OPPONENT, 50);

      AiService.doAiTurn(Player.OPPONENT, AiStrength.STRENGTH_3);

      expect(TurnRepository.get().player).toBe(Player.SELF);
    });

    test("can act from a game state restored through GameApi.loadGameState with strength 3", () => {
      addPiece(1, Player.SELF, pos(-2, 0));
      setResources(Player.SELF, 50);

      const snapshot = GameApi.getGameState();

      GameApi.initializeGame({ layer: 2 });
      const restoreResult = GameApi.loadGameState(snapshot);
      expect(restoreResult.ok).toBe(true);

      AiService.doAiTurn(Player.SELF, AiStrength.STRENGTH_3);

      expect(TurnRepository.get().player).toBe(Player.OPPONENT);
    });
  });
});
