import { beforeEach, describe, expect, test } from "vitest";
import { GameApi } from "$lib/api/GameApi";
import { MatchStatsRepository } from "$lib/data/repositories/MatchStatsRepository";
import { PieceType } from "$lib/domain/enums/PieceType";
import { Player } from "$lib/domain/enums/Player";
import { simulateTargetOutcome } from "$lib/services/ai/lookaheadSimulation";

describe("simulateTargetOutcome", () => {
  beforeEach(() => {
    GameApi.initializeGame({ layer: 4 });
  });

  test("restores live game state, history, and match stats after lookahead evaluation", () => {
    const generationResult = GameApi.generatePiece(Player.SELF, PieceType.KNIGHT);
    expect(generationResult.ok).toBe(true);

    const currentGameState = GameApi.getGameState();
    const pieceId = currentGameState.pieces[0]?.id;
    expect(pieceId).toBeDefined();

    const target = GameApi.getMovableTargets(pieceId!).find(
      (candidate) =>
        candidate.horizontalLayer !== currentGameState.pieces[0]?.initialPosition.horizontalLayer ||
        candidate.verticalLayer !== currentGameState.pieces[0]?.initialPosition.verticalLayer,
    );
    expect(target).toBeDefined();

    const historyBefore = GameApi.getGameStateHistory();
    const matchStatsBefore = MatchStatsRepository.get();
    const gameStateBefore = GameApi.getGameState();

    const score = simulateTargetOutcome(gameStateBefore, Player.SELF, pieceId!, target!);

    expect(score).not.toBe(Number.NEGATIVE_INFINITY);
    expect(GameApi.getGameState()).toEqual(gameStateBefore);
    expect(GameApi.getGameStateHistory()).toEqual(historyBefore);
    expect(MatchStatsRepository.get()).toEqual(matchStatsBefore);
  });
});
