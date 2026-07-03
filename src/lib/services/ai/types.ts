import type { PanelPosition } from "$lib/domain/entities/PanelPosition";
import type { PieceType } from "$lib/domain/enums/PieceType";

export type MoveSelectionStrategy = "strategic" | "lookahead";
export type GenerationModeSelectionStrategy = "frontline" | "adaptive-defense";
export type TargetScoringStrategy = "standard" | "home-side-growth";
export type PieceSelectionStrategy = "standard" | "infantry-balanced-support";

export interface AiStrengthProfile {
  moveSelection: MoveSelectionStrategy;
  generationModeSelection: GenerationModeSelectionStrategy;
  lookaheadCandidateCount: number;
  lookaheadWeight: number;
  preferredPieceOrder: PieceType[];
  targetScoring: TargetScoringStrategy;
  pieceSelection: PieceSelectionStrategy;
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
