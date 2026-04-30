import { AiStrength } from "$lib/domain/enums/AiStrength";
import { PieceType } from "$lib/domain/enums/PieceType";
import type { AiStrengthProfile } from "$lib/services/ai/types";

const DEFAULT_PREFERRED_PIECE_ORDER = [PieceType.ROOK, PieceType.KNIGHT, PieceType.BISHOP];

const AI_STRENGTH_PROFILES: Record<AiStrength, AiStrengthProfile> = {
  [AiStrength.STRENGTH_1]: {
    moveSelection: "strategic",
    generationModeSelection: "frontline",
    lookaheadCandidateCount: 0,
    lookaheadWeight: 0,
    preferredPieceOrder: DEFAULT_PREFERRED_PIECE_ORDER,
    targetScoring: "standard",
    pieceSelection: "standard",
  },
  [AiStrength.STRENGTH_2]: {
    moveSelection: "lookahead",
    generationModeSelection: "adaptive-defense",
    lookaheadCandidateCount: 3,
    lookaheadWeight: 0.25,
    preferredPieceOrder: DEFAULT_PREFERRED_PIECE_ORDER,
    targetScoring: "standard",
    pieceSelection: "standard",
  },
  [AiStrength.STRENGTH_3]: {
    moveSelection: "lookahead",
    generationModeSelection: "adaptive-defense",
    lookaheadCandidateCount: 3,
    lookaheadWeight: 0.25,
    preferredPieceOrder: DEFAULT_PREFERRED_PIECE_ORDER,
    targetScoring: "home-side-growth",
    pieceSelection: "knight-balanced-support",
  },
};

export function getStrengthProfile(strength: AiStrength): AiStrengthProfile {
  return AI_STRENGTH_PROFILES[strength] ?? AI_STRENGTH_PROFILES[AiStrength.STRENGTH_1];
}
