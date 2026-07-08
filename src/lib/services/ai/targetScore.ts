import { PASSIVE_CASTLE_CAP, PASSIVE_RESOURCE_CAP } from "$lib/domain/constants/GameConstants";
import type { PanelPosition } from "$lib/domain/entities/PanelPosition";
import type {
  GameStateSnapshot,
  PanelPositionSnapshot,
  PanelSnapshot,
  PieceSnapshot,
} from "$lib/domain/types/api";
import {
  findPanel,
  getEnemyHomeDistance,
  getHomeDistance,
  isEnemyHomeBase,
  positionEquals,
} from "$lib/services/ai/stateUtils";
import { getPieceCombatStats } from "$lib/services/ai/pieceCombatStats";
import type { AiStrengthProfile } from "$lib/services/ai/types";

export function scoreTarget(
  gameState: GameStateSnapshot,
  piece: PieceSnapshot,
  target: PanelPosition,
  profile: AiStrengthProfile,
  candidateTargets: PanelPosition[],
): number {
  const panel = findPanel(gameState, target);
  if (!panel) {
    return Number.NEGATIVE_INFINITY;
  }

  const enemyPieces = gameState.pieces.filter(
    (candidate) =>
      candidate.player !== piece.player && positionEquals(candidate.panelPosition, target),
  );
  const friendlyPieces = gameState.pieces.filter(
    (candidate) =>
      candidate.id !== piece.id &&
      candidate.player === piece.player &&
      positionEquals(candidate.panelPosition, target),
  );
  const hasEnemyCastle =
    panel.player !== piece.player && panel.player !== "unknown" && panel.castle > 0;
  const enemyHomeBase = isEnemyHomeBase(gameState, piece.player, target);

  if (enemyHomeBase && panel.castle === 0 && enemyPieces.length === 0) {
    return 1000;
  }

  if (enemyPieces.length > 0 || hasEnemyCastle) {
    return scoreAttackTarget(piece, panel, enemyPieces, enemyHomeBase, profile);
  }

  const baseScore = scoreNonCombatTarget(piece, panel, friendlyPieces, target);

  if (profile.targetScoring === "home-side-growth") {
    return (
      baseScore + scoreHomeSideGrowthAdjustment(gameState, piece, panel, target, candidateTargets)
    );
  }

  return baseScore;
}

function scoreNonCombatTarget(
  piece: PieceSnapshot,
  panel: PanelSnapshot,
  friendlyPieces: PieceSnapshot[],
  target: PanelPosition,
): number {
  const isStay = positionEquals(target, piece.initialPosition);
  if (isStay) {
    return 0;
  }

  const pieceStats = getPieceCombatStats(piece);
  const canMerge =
    pieceStats.mergeable &&
    friendlyPieces.some((candidate) => candidate.pieceType === piece.pieceType);
  if (canMerge) {
    return 35 + friendlyPieces.length * 5;
  }

  if (panel.player !== piece.player) {
    return 25 + panel.resource * 4;
  }

  return 6 + friendlyPieces.length * 2;
}

function scoreHomeSideGrowthAdjustment(
  gameState: GameStateSnapshot,
  piece: PieceSnapshot,
  panel: PanelSnapshot,
  target: PanelPosition,
  candidateTargets: PanelPosition[],
): number {
  if (piece.pieceType !== "rook" && piece.pieceType !== "noble") {
    return 0;
  }

  const growthCap = piece.pieceType === "rook" ? PASSIVE_CASTLE_CAP : PASSIVE_RESOURCE_CAP;
  const reachableGrowthTargets = getReachableGrowthTargets(
    gameState,
    piece,
    candidateTargets,
    growthCap,
  );
  const currentPanel = findPanel(gameState, piece.initialPosition);
  const currentPanelNeedsGrowth =
    currentPanel !== undefined && panelNeedsGrowth(currentPanel, piece.pieceType, growthCap);

  if (currentPanelNeedsGrowth) {
    return positionEquals(target, piece.initialPosition)
      ? 420 + scoreGrowthPriority(gameState, piece.player, currentPanel, piece.pieceType)
      : -260 - scoreAdvanceFromHome(gameState, piece.player, piece.initialPosition, target);
  }

  if (reachableGrowthTargets.some((growthTarget) => positionEquals(growthTarget, target))) {
    return 300 + scoreGrowthPriority(gameState, piece.player, panel, piece.pieceType);
  }

  if (reachableGrowthTargets.length > 0) {
    return -240 - scoreAdvanceFromHome(gameState, piece.player, piece.initialPosition, target);
  }

  return scoreAdvanceTowardEnemyHome(gameState, piece.player, piece.initialPosition, target);
}

function getReachableGrowthTargets(
  gameState: GameStateSnapshot,
  piece: PieceSnapshot,
  candidateTargets: PanelPosition[],
  growthCap: number,
): PanelPosition[] {
  return candidateTargets.filter((candidateTarget) => {
    if (positionEquals(candidateTarget, piece.initialPosition)) {
      return false;
    }

    const candidatePanel = findPanel(gameState, candidateTarget);
    if (!candidatePanel) {
      return false;
    }

    return panelNeedsGrowth(candidatePanel, piece.pieceType, growthCap);
  });
}

function panelNeedsGrowth(
  panel: PanelSnapshot,
  pieceType: PieceSnapshot["pieceType"],
  growthCap: number,
): boolean {
  return getPanelGrowthValue(panel, pieceType) < growthCap;
}

function getPanelGrowthValue(panel: PanelSnapshot, pieceType: PieceSnapshot["pieceType"]): number {
  return pieceType === "rook" ? panel.castle : panel.resource;
}

function scoreGrowthPriority(
  gameState: GameStateSnapshot,
  player: PieceSnapshot["player"],
  panel: PanelSnapshot,
  pieceType: PieceSnapshot["pieceType"],
): number {
  const growthCap = pieceType === "rook" ? PASSIVE_CASTLE_CAP : PASSIVE_RESOURCE_CAP;
  const growthGap = growthCap - getPanelGrowthValue(panel, pieceType);

  return growthGap * 24 - getHomeDistance(gameState, player, panel.panelPosition) * 12;
}

function scoreAdvanceFromHome(
  gameState: GameStateSnapshot,
  player: PieceSnapshot["player"],
  origin: PanelPositionSnapshot,
  target: PanelPositionSnapshot,
): number {
  const homeDistanceDelta =
    getHomeDistance(gameState, player, target) - getHomeDistance(gameState, player, origin);
  return Math.max(0, homeDistanceDelta) * 30;
}

function scoreAdvanceTowardEnemyHome(
  gameState: GameStateSnapshot,
  player: PieceSnapshot["player"],
  origin: PanelPositionSnapshot,
  target: PanelPositionSnapshot,
): number {
  if (positionEquals(origin, target)) {
    return -120;
  }

  const originEnemyDistance = getEnemyHomeDistance(gameState, player, origin);
  const targetEnemyDistance = getEnemyHomeDistance(gameState, player, target);

  return (originEnemyDistance - targetEnemyDistance) * 40;
}

/**
 * Penalty applied per remaining castle point when a piece can't demolish the wall
 * outright this turn. "aggressive" profiles (weak AI levels without a concentrated
 * merge stack) use a much smaller penalty so chipping away at a wall over several
 * turns still scores above idling, instead of only ever rewarding a one-shot breach.
 */
const REMAINING_CASTLE_PENALTY: Record<AiStrengthProfile["combatAssertiveness"], number> = {
  standard: 8,
  aggressive: 1,
};

/**
 * Weight applied to how far a piece's estimated damage output falls short of
 * the defenders' total HP (attackMargin / overflow-phase margin). "aggressive"
 * profiles heavily discount this, since the estimate only ever judges a single
 * piece/stack in isolation — it can't know that other nearby friendly pieces
 * would also join the fight this turn and tip a "losing" estimate into a win.
 * Lv1 has no lookahead simulation to double-check a risky-looking estimate, so
 * it must commit to fights the naive margin alone would call unfavorable.
 */
const HOSTILE_MARGIN_WEIGHT: Record<AiStrengthProfile["combatAssertiveness"], number> = {
  standard: 8,
  aggressive: 1,
};
const OVERFLOW_MARGIN_WEIGHT: Record<AiStrengthProfile["combatAssertiveness"], number> = {
  standard: 6,
  aggressive: 1,
};

/** Flat penalty for a fight the naive margin predicts as mutual destruction. */
const MUTUAL_DESTRUCTION_PENALTY: Record<AiStrengthProfile["combatAssertiveness"], number> = {
  standard: 140,
  aggressive: 0,
};
const OVERFLOW_MUTUAL_DESTRUCTION_PENALTY: Record<AiStrengthProfile["combatAssertiveness"], number> =
  {
    standard: 120,
    aggressive: 0,
  };

function scoreAttackTarget(
  piece: PieceSnapshot,
  panel: PanelSnapshot,
  enemyPieces: PieceSnapshot[],
  enemyHomeBase: boolean,
  profile: AiStrengthProfile,
): number {
  const pieceStats = getPieceCombatStats(piece);
  if (!pieceStats.canAttack) {
    return Number.NEGATIVE_INFINITY;
  }

  const totalEnemyHp = enemyPieces.reduce((sum, enemyPiece) => sum + enemyPiece.hp, 0);
  const totalEnemyAttack = enemyPieces.reduce(
    (sum, enemyPiece) => sum + getPieceCombatStats(enemyPiece).attackPowerAgainstPiece,
    0,
  );

  let score = panel.player !== piece.player ? 12 + panel.resource * 2 : 0;

  if (panel.castle > 0) {
    if (pieceStats.attackPowerAgainstWall <= 0) {
      return -120;
    }

    const remainingCastle = Math.max(0, panel.castle - pieceStats.attackPowerAgainstWall);
    const overflowRatio =
      Math.max(0, pieceStats.attackPowerAgainstWall - panel.castle) /
      pieceStats.attackPowerAgainstWall;
    const overflowPieceDamage = pieceStats.attackPowerAgainstPiece * overflowRatio;

    score +=
      18 -
      remainingCastle * REMAINING_CASTLE_PENALTY[profile.combatAssertiveness] +
      overflowPieceDamage * 4;

    if (remainingCastle === 0 && enemyPieces.length === 0) {
      return enemyHomeBase ? 1000 : score + 80;
    }

    // PieceService only resolves piece-vs-piece combat (including defender
    // counterattack) once wall damage actually overflows the castle — see
    // PieceService's `wallAttackResult.overflowPieceDamage > 0` gate. Below
    // that threshold, chipping the wall is completely risk-free, so the
    // defenders' HP/attack must not factor into the score at all.
    if (enemyPieces.length > 0 && overflowPieceDamage > 0) {
      score +=
        (overflowPieceDamage - totalEnemyHp) * OVERFLOW_MARGIN_WEIGHT[profile.combatAssertiveness];
      if (overflowPieceDamage >= totalEnemyHp) {
        score += 40;
      }
      if (totalEnemyAttack >= piece.hp && overflowPieceDamage < totalEnemyHp) {
        score -= OVERFLOW_MUTUAL_DESTRUCTION_PENALTY[profile.combatAssertiveness];
      }
    }

    return score;
  }

  const attackMargin = pieceStats.attackPowerAgainstPiece - totalEnemyHp;
  const survivalMargin = piece.hp - totalEnemyAttack;

  score += attackMargin * HOSTILE_MARGIN_WEIGHT[profile.combatAssertiveness] + survivalMargin * 3;

  if (attackMargin >= 0) {
    score += enemyHomeBase ? 1000 : 70;
  }

  if (survivalMargin <= 0 && attackMargin < 0) {
    score -= MUTUAL_DESTRUCTION_PENALTY[profile.combatAssertiveness];
  }

  return score;
}
