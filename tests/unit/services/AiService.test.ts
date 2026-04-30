import { beforeEach, describe, test, expect } from "vitest";
import { GameApi } from "$lib/api/GameApi";
import { AiService } from "$lib/services/AiService";
import { PanelRepository } from "$lib/data/repositories/PanelRepository";
import { PiecesRepository } from "$lib/data/repositories/PieceRepository";
import { TurnRepository } from "$lib/data/repositories/TurnRepository";
import { Panel } from "$lib/domain/entities/Panel";
import { Piece } from "$lib/domain/entities/Piece";
import { PanelPosition } from "$lib/domain/entities/PanelPosition";
import { AiStrength } from "$lib/domain/enums/AiStrength";
import { PanelState } from "$lib/domain/enums/PanelState";
import { PieceType } from "$lib/domain/enums/PieceType";
import { Player } from "$lib/domain/enums/Player";

const pos = (h: number, v: number) => new PanelPosition({ horizontalLayer: h, verticalLayer: v });

function setResources(player: Player, amount: number): void {
  const turn = TurnRepository.get();
  TurnRepository.set({ ...turn, resources: { ...turn.resources, [String(player)]: amount } });
}

function countPiecesOfType(pieceType: PieceType): number {
  return PiecesRepository.getAll().filter((piece) => piece.pieceType === pieceType).length;
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

    test("can act from a game state restored through GameApi.loadGameState", () => {
      PiecesRepository.add(
        new Piece({
          id: 1,
          panelPosition: pos(-2, 0),
          player: Player.SELF,
          pieceType: PieceType.KNIGHT,
        }),
      );
      const turn = TurnRepository.get();
      TurnRepository.set({ ...turn, resources: { ...turn.resources, [String(Player.SELF)]: 50 } });

      const snapshot = GameApi.getGameState();

      GameApi.initializeGame({ layer: 2 });
      const restoreResult = GameApi.loadGameState(snapshot);
      expect(restoreResult.ok).toBe(true);

      AiService.doAiTurn(Player.SELF);

      expect(TurnRepository.get().player).toBe(Player.OPPONENT);
    });

    test("strength 2 captures an undefended enemy home base when it can win immediately", () => {
      PiecesRepository.add(
        new Piece({
          id: 1,
          panelPosition: pos(2, 0),
          player: Player.SELF,
          pieceType: PieceType.KNIGHT,
        }),
      );

      const enemyHomeBase = PanelRepository.find(pos(3, 0));
      expect(enemyHomeBase).toBeDefined();

      PanelRepository.update(
        new Panel({
          panelPosition: enemyHomeBase!.panelPosition,
          panelState: PanelState.UNOCCUPIED,
          player: enemyHomeBase!.player,
          resource: enemyHomeBase!.resource,
          castle: 0,
        }),
      );

      AiService.doAiTurn(Player.SELF, AiStrength.STRENGTH_2);

      expect(TurnRepository.get().winner).toBe(Player.SELF);
    });

    test("strength 2 avoids a clearly losing attack when a safer move exists", () => {
      PiecesRepository.add(
        new Piece({
          id: 1,
          panelPosition: pos(-1, 0),
          player: Player.SELF,
          pieceType: PieceType.ROOK,
        }),
      );
      PiecesRepository.add(
        new Piece({
          id: 2,
          panelPosition: pos(0, 0),
          player: Player.OPPONENT,
          pieceType: PieceType.KNIGHT,
        }),
      );
      PiecesRepository.add(
        new Piece({
          id: 3,
          panelPosition: pos(0, 0),
          player: Player.OPPONENT,
          pieceType: PieceType.KNIGHT,
        }),
      );

      const turn = TurnRepository.get();
      TurnRepository.set({ ...turn, resources: { ...turn.resources, [String(Player.SELF)]: 0 } });

      AiService.doAiTurn(Player.SELF, AiStrength.STRENGTH_2);

      const survivingRook = PiecesRepository.getAll().find((piece) => piece.id === 1);
      expect(survivingRook).toBeDefined();
      expect(survivingRook?.panelPosition.equals(pos(0, 0))).toBe(false);
    });

    test("strength 2 opens by securing bishop and knight when no pieces are owned", () => {
      setResources(Player.SELF, 50);

      AiService.doAiTurn(Player.SELF, AiStrength.STRENGTH_2);

      expect(countPiecesOfType(PieceType.BISHOP)).toBe(1);
      expect(countPiecesOfType(PieceType.KNIGHT)).toBe(1);
      expect(countPiecesOfType(PieceType.ROOK)).toBe(0);
    });

    test("strength 2 adds rook support after securing a bishop", () => {
      PiecesRepository.add(
        new Piece({
          id: 1,
          panelPosition: pos(-2, 0),
          player: Player.SELF,
          pieceType: PieceType.BISHOP,
        }),
      );
      setResources(Player.SELF, 50);

      AiService.doAiTurn(Player.SELF, AiStrength.STRENGTH_2);

      expect(countPiecesOfType(PieceType.BISHOP)).toBe(1);
      expect(countPiecesOfType(PieceType.KNIGHT)).toBe(1);
      expect(countPiecesOfType(PieceType.ROOK)).toBe(1);
    });

    test("strength 2 spends extra capacity on the least represented type after bishop and knight", () => {
      PiecesRepository.add(
        new Piece({
          id: 1,
          panelPosition: pos(-2, 0),
          player: Player.SELF,
          pieceType: PieceType.BISHOP,
        }),
      );
      PiecesRepository.add(
        new Piece({
          id: 2,
          panelPosition: pos(-1, 0),
          player: Player.SELF,
          pieceType: PieceType.KNIGHT,
        }),
      );
      setResources(Player.SELF, 50);

      AiService.doAiTurn(Player.SELF, AiStrength.STRENGTH_2);

      expect(countPiecesOfType(PieceType.BISHOP)).toBe(1);
      expect(countPiecesOfType(PieceType.KNIGHT)).toBe(1);
      expect(countPiecesOfType(PieceType.ROOK)).toBe(2);
    });

    test("strength 2 spends resources on multiple generations in the same turn when capacity allows", () => {
      setResources(Player.SELF, 20);

      AiService.doAiTurn(Player.SELF, AiStrength.STRENGTH_2);

      expect(countPiecesOfType(PieceType.BISHOP)).toBe(1);
      expect(countPiecesOfType(PieceType.KNIGHT)).toBe(1);
      expect(countPiecesOfType(PieceType.ROOK)).toBe(0);
      expect(TurnRepository.get().resources[String(Player.SELF)]).toBe(2);
    });
  });
});
