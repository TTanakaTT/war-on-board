import type { PanelPosition } from "$lib/domain/entities/PanelPosition";
import type { PieceType } from "$lib/domain/enums/PieceType";

export type MoveSelectionStrategy = "strategic" | "lookahead";
export type GenerationModeSelectionStrategy = "frontline" | "adaptive-defense";
export type TargetScoringStrategy = "standard" | "home-side-growth";
export type PieceSelectionStrategy = "standard" | "infantry-balanced-support";
/**
 * How cautiously scoreAttackTarget weighs its own win/loss estimate before
 * committing to combat. "standard" trusts the estimate; "aggressive" (weak AI
 * levels with no lookahead safety net to double-check a risky-looking attack)
 * heavily discounts it so the AI still commits to fights an estimate alone
 * would call unfavorable, rather than stalling out forever against an
 * opponent that can out-scale a lone attacker's naive margin.
 */
export type CombatAssertivenessStrategy = "standard" | "aggressive";

export interface AiStrengthProfile {
  moveSelection: MoveSelectionStrategy;
  generationModeSelection: GenerationModeSelectionStrategy;
  lookaheadCandidateCount: number;
  lookaheadWeight: number;
  preferredPieceOrder: PieceType[];
  targetScoring: TargetScoringStrategy;
  pieceSelection: PieceSelectionStrategy;
  combatAssertiveness: CombatAssertivenessStrategy;
}

export interface PieceCombatStats {
  attackPowerAgainstPiece: number;
  attackPowerAgainstWall: number;
  defense: number;
  canAttack: boolean;
  mergeable: boolean;
}

export interface ScoredTarget {
  score: number;
  target: PanelPosition;
  laneLoad: number;
  laneShift: number;
}

export interface PieceTypeCounts {
  infantry: number;
  rook: number;
  noble: number;
  archer: number;
  cavalry: number;
  heavy: number;
  siege: number;
}
