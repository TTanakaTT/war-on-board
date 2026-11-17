import type { PanelPosition } from "#lib/domain/entities/PanelPosition.ts";
import type { GameStateSnapshot, PieceSnapshot } from "#lib/domain/types/api.ts";
import { shuffle, type RandomSource } from "#lib/services/ai/random.ts";
import { scoreTarget } from "#lib/services/ai/targetScore.ts";
import type { AiStrengthProfile, ScoredTarget } from "#lib/services/ai/types.ts";

export function selectStrategicTarget(
  gameState: GameStateSnapshot,
  piece: PieceSnapshot,
  targets: PanelPosition[],
  profile: AiStrengthProfile,
  random: RandomSource,
): PanelPosition {
  const scoredTargets = getSortedScoredTargets(gameState, piece, targets, profile, random);

  return scoredTargets[0]?.target ?? targets[0];
}

/**
 * Scores every target and sorts them by score, highest first. Targets with the same score
 * end up in a uniformly random order.
 */
export function getSortedScoredTargets(
  gameState: GameStateSnapshot,
  piece: PieceSnapshot,
  targets: PanelPosition[],
  profile: AiStrengthProfile,
  random: RandomSource,
): ScoredTarget[] {
  const scoredTargets: ScoredTarget[] = targets.map((target) => ({
    target,
    score: scoreTarget(gameState, piece, target, profile, targets),
  }));

  return sortByScoreWithRandomTies(scoredTargets, random);
}

/** Shuffles first, then stable-sorts by score descending, so ties are picked uniformly. */
export function sortByScoreWithRandomTies(
  scoredTargets: readonly ScoredTarget[],
  random: RandomSource,
): ScoredTarget[] {
  return shuffle(scoredTargets, random).sort((left, right) => right.score - left.score);
}

export { getPieceCombatStats } from "#lib/services/ai/pieceCombatStats.ts";
