import type { PanelPosition } from "#lib/domain/entities/PanelPosition.ts";
import type { Player } from "#lib/domain/enums/Player.ts";
import type { GameStateSnapshot, PieceSnapshot } from "#lib/domain/types/api.ts";
import { simulateTargetOutcome } from "#lib/services/ai/lookaheadSimulation.ts";
import type { RandomSource } from "#lib/services/ai/random.ts";
import {
  getSortedScoredTargets,
  sortByScoreWithRandomTies,
} from "#lib/services/ai/targetScoring.ts";
import type { AiStrengthProfile, ScoredTarget } from "#lib/services/ai/types.ts";

export function selectLookaheadTarget(
  gameState: GameStateSnapshot,
  piece: PieceSnapshot,
  targets: PanelPosition[],
  player: Player,
  profile: AiStrengthProfile,
  random: RandomSource,
): PanelPosition {
  const topCandidates = getSortedScoredTargets(gameState, piece, targets, profile, random).slice(
    0,
    profile.lookaheadCandidateCount,
  );

  const lookaheadTargets: ScoredTarget[] = topCandidates.map((candidate) => ({
    target: candidate.target,
    score:
      candidate.score +
      simulateTargetOutcome(gameState, player, piece.id, candidate.target) *
        profile.lookaheadWeight,
  }));

  return sortByScoreWithRandomTies(lookaheadTargets, random)[0]?.target ?? targets[0];
}
