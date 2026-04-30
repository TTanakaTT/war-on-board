import type { PanelPosition } from "$lib/domain/entities/PanelPosition";
import { Player } from "$lib/domain/enums/Player";
import type { GameStateSnapshot, PieceSnapshot } from "$lib/domain/types/api";
import { simulateTargetOutcome } from "$lib/services/ai/lookaheadSimulation";
import { compareScoredTargets, getSortedScoredTargets } from "$lib/services/ai/targetScoring";
import type { AiStrengthProfile } from "$lib/services/ai/types";

export function selectLookaheadTarget(
  gameState: GameStateSnapshot,
  piece: PieceSnapshot,
  targets: PanelPosition[],
  player: Player,
  profile: AiStrengthProfile,
): PanelPosition {
  const topCandidates = getSortedScoredTargets(gameState, piece, targets, profile).slice(
    0,
    profile.lookaheadCandidateCount,
  );

  const lookaheadTargets = topCandidates.map((candidate) => ({
    target: candidate.target,
    score:
      candidate.score +
      simulateTargetOutcome(gameState, player, piece.id, candidate.target) *
        profile.lookaheadWeight,
    laneLoad: candidate.laneLoad,
    laneShift: candidate.laneShift,
  }));

  lookaheadTargets.sort((left, right) => compareScoredTargets(left, right, player));

  return lookaheadTargets[0]?.target ?? targets[0];
}
