import { PASSIVE_WALL_CAP, PASSIVE_RESOURCE_CAP } from "#lib/domain/config.ts";
import {
  pieceConfig,
  samePos,
  type GameState,
  type Panel,
  type PanelPosition,
  type Piece,
  type PieceType,
  type Player,
} from "#lib/domain/model.ts";
import { shuffle, type RandomSource } from "#lib/services/ai/random.ts";

export interface AiStrengthProfile {
  moveSelection: "strategic" | "lookahead";
  generationModeSelection: "frontline" | "adaptive-defense";
  lookaheadCandidateCount: number;
  lookaheadWeight: number;
  preferredPieceOrder: PieceType[];
  targetScoring: "standard" | "home-side-growth";
  pieceSelection: "standard" | "infantry-balanced-support";
  /** "aggressive" discounts its own naive combat estimates (for levels without lookahead). */
  combatAssertiveness: "standard" | "aggressive";
}

export interface ScoredTarget {
  score: number;
  target: PanelPosition;
}

type Assertiveness = Record<AiStrengthProfile["combatAssertiveness"], number>;
const REMAINING_WALL_PENALTY: Assertiveness = { standard: 8, aggressive: 1 };
const HOSTILE_MARGIN_WEIGHT: Assertiveness = { standard: 8, aggressive: 1 };
const OVERFLOW_MARGIN_WEIGHT: Assertiveness = { standard: 6, aggressive: 1 };
const MUTUAL_DESTRUCTION_PENALTY: Assertiveness = { standard: 140, aggressive: 0 };
const OVERFLOW_MUTUAL_DESTRUCTION_PENALTY: Assertiveness = { standard: 120, aggressive: 0 };

export const findPanel = (state: GameState, target: PanelPosition): Panel | undefined =>
  state.panels.find((panel) => samePos(panel.panelPosition, target));

export const findHomeBase = (state: GameState, player: Player) =>
  state.homeBases.find((homeBase) => homeBase.player === player);

const horizontalDistance = (a: PanelPosition, b?: PanelPosition) =>
  b ? Math.abs(a.horizontalLayer - b.horizontalLayer) : Number.MAX_SAFE_INTEGER;

const homeDistance = (state: GameState, player: Player, p: PanelPosition) =>
  horizontalDistance(p, findHomeBase(state, player)?.panelPosition);

const enemyHomeDistance = (state: GameState, player: Player, p: PanelPosition) =>
  horizontalDistance(p, state.homeBases.find((h) => h.player !== player)?.panelPosition);

/** Whole-stack combat output, matching what CombatService deals. */
export function getPieceCombatStats(piece: Piece) {
  const config = pieceConfig(piece.pieceType);
  const attackPowerAgainstPiece = config.attackPowerAgainstPiece * piece.stackCount;
  const attackPowerAgainstWall = config.attackPowerAgainstWall * piece.stackCount;
  return {
    attackPowerAgainstPiece,
    attackPowerAgainstWall,
    defense: config.defense,
    canAttack: attackPowerAgainstPiece > 0 || attackPowerAgainstWall > 0,
    mergeable: config.mergeable,
  };
}

export function scoreTarget(
  state: GameState,
  piece: Piece,
  target: PanelPosition,
  profile: AiStrengthProfile,
  candidateTargets: PanelPosition[],
): number {
  const panel = findPanel(state, target);
  if (!panel) return Number.NEGATIVE_INFINITY;

  const at = state.pieces.filter((p) => samePos(p.panelPosition, target));
  const enemies = at.filter((p) => p.player !== piece.player);
  const friends = at.filter((p) => p.id !== piece.id && p.player === piece.player);
  const hasEnemyWall =
    panel.player !== piece.player && panel.player !== "unknown" && panel.wall > 0;
  const isEnemyHome = state.homeBases.some(
    (h) => h.player !== piece.player && samePos(h.panelPosition, target),
  );

  if (isEnemyHome && panel.wall === 0 && enemies.length === 0) return 1000;
  if (enemies.length > 0 || hasEnemyWall) {
    return scoreAttackTarget(piece, panel, enemies, isEnemyHome, profile);
  }
  const base = scoreNonCombatTarget(piece, panel, friends, target);
  return profile.targetScoring === "home-side-growth"
    ? base + scoreHomeSideGrowth(state, piece, panel, target, candidateTargets)
    : base;
}

function scoreNonCombatTarget(piece: Piece, panel: Panel, friends: Piece[], target: PanelPosition) {
  if (samePos(target, piece.initialPosition)) return 0;
  const canMerge =
    getPieceCombatStats(piece).mergeable && friends.some((p) => p.pieceType === piece.pieceType);
  if (canMerge) return 35 + friends.length * 5;
  if (panel.player !== piece.player) return 25 + panel.resource * 4;
  return 6 + friends.length * 2;
}

/** Rooks and Nobles stay to grow panels near home before advancing. */
function scoreHomeSideGrowth(
  state: GameState,
  piece: Piece,
  panel: Panel,
  target: PanelPosition,
  candidateTargets: PanelPosition[],
): number {
  const type = piece.pieceType;
  if (type !== "rook" && type !== "noble") return 0;

  const cap = type === "rook" ? PASSIVE_WALL_CAP : PASSIVE_RESOURCE_CAP;
  const growth = (p: Panel) => (type === "rook" ? p.wall : p.resource);
  const priority = (p: Panel) =>
    (cap - growth(p)) * 24 - homeDistance(state, piece.player, p.panelPosition) * 12;
  const advanceFromHome = () =>
    Math.max(
      0,
      homeDistance(state, piece.player, target) -
        homeDistance(state, piece.player, piece.initialPosition),
    ) * 30;

  const growthTargets = candidateTargets.filter((candidate) => {
    if (samePos(candidate, piece.initialPosition)) return false;
    const candidatePanel = findPanel(state, candidate);
    return !!candidatePanel && growth(candidatePanel) < cap;
  });
  const current = findPanel(state, piece.initialPosition);

  if (current && growth(current) < cap) {
    return samePos(target, piece.initialPosition)
      ? 420 + priority(current)
      : -260 - advanceFromHome();
  }
  if (growthTargets.some((t) => samePos(t, target))) return 300 + priority(panel);
  if (growthTargets.length > 0) return -240 - advanceFromHome();
  if (samePos(piece.initialPosition, target)) return -120;
  return (
    (enemyHomeDistance(state, piece.player, piece.initialPosition) -
      enemyHomeDistance(state, piece.player, target)) *
    40
  );
}

function scoreAttackTarget(
  piece: Piece,
  panel: Panel,
  enemies: Piece[],
  isEnemyHome: boolean,
  profile: AiStrengthProfile,
): number {
  const stats = getPieceCombatStats(piece);
  if (!stats.canAttack) return Number.NEGATIVE_INFINITY;

  const mode = profile.combatAssertiveness;
  const enemyHp = enemies.reduce((sum, p) => sum + p.hp, 0);
  const enemyAttack = enemies.reduce(
    (sum, p) => sum + getPieceCombatStats(p).attackPowerAgainstPiece,
    0,
  );
  let score = panel.player !== piece.player ? 12 + panel.resource * 2 : 0;

  if (panel.wall > 0) {
    if (stats.attackPowerAgainstWall <= 0) return -120;
    const remainingWall = Math.max(0, panel.wall - stats.attackPowerAgainstWall);
    const overflowRatio =
      Math.max(0, stats.attackPowerAgainstWall - panel.wall) / stats.attackPowerAgainstWall;
    const overflowDamage = stats.attackPowerAgainstPiece * overflowRatio;
    score += 18 - remainingWall * REMAINING_WALL_PENALTY[mode] + overflowDamage * 4;

    if (remainingWall === 0 && enemies.length === 0) return isEnemyHome ? 1000 : score + 80;
    // Defenders only fight back once wall damage overflows.
    if (enemies.length > 0 && overflowDamage > 0) {
      score += (overflowDamage - enemyHp) * OVERFLOW_MARGIN_WEIGHT[mode];
      if (overflowDamage >= enemyHp) score += 40;
      if (enemyAttack >= piece.hp && overflowDamage < enemyHp) {
        score -= OVERFLOW_MUTUAL_DESTRUCTION_PENALTY[mode];
      }
    }
    return score;
  }

  const attackMargin = stats.attackPowerAgainstPiece - enemyHp;
  const survivalMargin = piece.hp - enemyAttack;
  score += attackMargin * HOSTILE_MARGIN_WEIGHT[mode] + survivalMargin * 3;
  if (attackMargin >= 0) score += isEnemyHome ? 1000 : 70;
  if (survivalMargin <= 0 && attackMargin < 0) score -= MUTUAL_DESTRUCTION_PENALTY[mode];
  return score;
}

/** Shuffle, then stable-sort descending, so ties are picked uniformly. */
export function sortByScoreWithRandomTies(
  scored: readonly ScoredTarget[],
  random: RandomSource,
): ScoredTarget[] {
  return shuffle(scored, random).sort((a, b) => b.score - a.score);
}

export function getSortedScoredTargets(
  state: GameState,
  piece: Piece,
  targets: PanelPosition[],
  profile: AiStrengthProfile,
  random: RandomSource,
): ScoredTarget[] {
  return sortByScoreWithRandomTies(
    targets.map((target) => ({
      target,
      score: scoreTarget(state, piece, target, profile, targets),
    })),
    random,
  );
}
