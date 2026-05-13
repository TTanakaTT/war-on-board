import type { PanelPosition } from "$lib/domain/entities/PanelPosition";
import { Player } from "$lib/domain/enums/Player";
import type { GameStateSnapshot, PieceSnapshot } from "$lib/domain/types/api";
import { scoreTarget } from "$lib/services/ai/targetScore";
import type { AiStrengthProfile, ScoredTarget } from "$lib/services/ai/types";

export function selectStrategicTarget(
  gameState: GameStateSnapshot,
  piece: PieceSnapshot,
  targets: PanelPosition[],
  profile: AiStrengthProfile,
): PanelPosition {
  const scoredTargets = getSortedScoredTargets(gameState, piece, targets, profile);

  return scoredTargets[0]?.target ?? targets[0];
}

export function getSortedScoredTargets(
  gameState: GameStateSnapshot,
  piece: PieceSnapshot,
  targets: PanelPosition[],
  profile: AiStrengthProfile,
): ScoredTarget[] {
  const scoredTargets: ScoredTarget[] = targets.map((target) => ({
    target,
    score: scoreTarget(gameState, piece, target, profile, targets),
    laneLoad: countLaneLoad(gameState, piece.player, target.verticalLayer, piece.id),
    laneShift: Math.abs(target.verticalLayer - piece.initialPosition.verticalLayer),
  }));

  scoredTargets.sort((left, right) => compareScoredTargets(left, right, piece.player));

  return scoredTargets;
}

export function compareScoredTargets(
  left: ScoredTarget,
  right: ScoredTarget,
  player: Player | PieceSnapshot["player"],
): number {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  if (left.target.horizontalLayer !== right.target.horizontalLayer) {
    return player === Player.SELF || player === "self"
      ? right.target.horizontalLayer - left.target.horizontalLayer
      : left.target.horizontalLayer - right.target.horizontalLayer;
  }

  if (left.laneLoad !== right.laneLoad) {
    return left.laneLoad - right.laneLoad;
  }

  if (left.laneShift !== right.laneShift) {
    return left.laneShift - right.laneShift;
  }

  return 0;
}

function countLaneLoad(
  gameState: GameStateSnapshot,
  player: PieceSnapshot["player"],
  verticalLayer: number,
  excludedPieceId: number,
): number {
  return gameState.pieces.filter((piece) => {
    if (piece.id === excludedPieceId || piece.player !== player) {
      return false;
    }

    const plannedPosition = piece.targetPosition ?? piece.panelPosition;
    return plannedPosition.verticalLayer === verticalLayer;
  }).length;
}

export { getPieceCombatStats } from "$lib/services/ai/pieceCombatStats";
