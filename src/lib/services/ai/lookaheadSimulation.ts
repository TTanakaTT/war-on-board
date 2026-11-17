import { GameApi } from "#lib/api/GameApi.ts";
import type { PanelPosition } from "#lib/domain/entities/PanelPosition.ts";
import { Player } from "#lib/domain/enums/Player.ts";
import type { GameStateSnapshot } from "#lib/domain/types/api.ts";
import { scoreBoardState } from "#lib/services/ai/boardEvaluation.ts";

export function simulateTargetOutcome(
  gameState: GameStateSnapshot,
  player: Player,
  pieceId: number,
  target: PanelPosition,
): number {
  const simulationResult = GameApi.withTemporaryGameState(gameState, () => {
    const assignResult = GameApi.assignMove(player, pieceId, target);
    if (!assignResult.ok) {
      return Number.NEGATIVE_INFINITY;
    }

    const endTurnResult = GameApi.endTurn(player);
    if (!endTurnResult.ok) {
      return Number.NEGATIVE_INFINITY;
    }

    return scoreBoardState(GameApi.getGameState(), player);
  });

  if (!simulationResult.ok) {
    return Number.NEGATIVE_INFINITY;
  }

  return simulationResult.value;
}
