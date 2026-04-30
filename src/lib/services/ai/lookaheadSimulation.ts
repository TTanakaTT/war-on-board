import { GameApi } from "$lib/api/GameApi";
import { GameStateHistoryRepository } from "$lib/data/repositories/GameStateHistoryRepository";
import type { PanelPosition } from "$lib/domain/entities/PanelPosition";
import { Player } from "$lib/domain/enums/Player";
import type { GameStateSnapshot } from "$lib/domain/types/api";
import { scoreBoardState } from "$lib/services/ai/boardEvaluation";

export function simulateTargetOutcome(
  gameState: GameStateSnapshot,
  player: Player,
  pieceId: number,
  target: PanelPosition,
): number {
  const historySnapshot = GameApi.getGameStateHistory();

  try {
    const loadResult = GameApi.loadGameState(gameState);
    if (!loadResult.ok) {
      return Number.NEGATIVE_INFINITY;
    }

    const assignResult = GameApi.assignMove(player, pieceId, target);
    if (!assignResult.ok) {
      return Number.NEGATIVE_INFINITY;
    }

    const endTurnResult = GameApi.endTurn(player);
    if (!endTurnResult.ok) {
      return Number.NEGATIVE_INFINITY;
    }

    return scoreBoardState(GameApi.getGameState(), player);
  } finally {
    GameApi.loadGameState(gameState);
    GameStateHistoryRepository.setAll(historySnapshot);
  }
}
