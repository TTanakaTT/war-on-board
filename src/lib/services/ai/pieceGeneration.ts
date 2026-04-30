import { GameApi } from "$lib/api/GameApi";
import { AI_SUPPORT_PIECE_CAP } from "$lib/domain/constants/GameConstants";
import type { GenerationMode } from "$lib/domain/entities/Turn";
import { Player } from "$lib/domain/enums/Player";
import { PieceType } from "$lib/domain/enums/PieceType";
import type { GameStateSnapshot } from "$lib/domain/types/api";
import { findHomeBase, getOpponentPlayer, toPlayerSnapshot } from "$lib/services/ai/stateUtils";
import type { AiStrengthProfile, PieceTypeCounts } from "$lib/services/ai/types";

export function selectStrategicPieceType(
  gameState: GameStateSnapshot,
  player: Player,
  currentResources: number,
  preferredOrder: PieceType[],
  profile: AiStrengthProfile,
): PieceType | null {
  const affordablePieceTypes = getAffordablePieceTypes(player, currentResources, preferredOrder);
  const pieceTypeCounts = countPieceTypes(gameState, player);
  const availablePieceTypes = filterAvailablePieceTypesForProfile(
    affordablePieceTypes,
    pieceTypeCounts,
    profile,
  );
  if (availablePieceTypes.length === 0) {
    return null;
  }

  if (pieceTypeCounts.bishop === 0 && availablePieceTypes.includes(PieceType.BISHOP)) {
    return PieceType.BISHOP;
  }

  if (pieceTypeCounts.knight === 0 && availablePieceTypes.includes(PieceType.KNIGHT)) {
    return PieceType.KNIGHT;
  }

  if (pieceTypeCounts.rook === 0 && availablePieceTypes.includes(PieceType.ROOK)) {
    return PieceType.ROOK;
  }

  return availablePieceTypes.sort((left, right) => {
    const countDiff =
      pieceTypeCounts[String(left) as keyof PieceTypeCounts] -
      pieceTypeCounts[String(right) as keyof PieceTypeCounts];
    if (countDiff !== 0) {
      return countDiff;
    }

    return preferredOrder.indexOf(left) - preferredOrder.indexOf(right);
  })[0];
}

export function selectGenerationMode(
  gameState: GameStateSnapshot,
  player: Player,
  profile: AiStrengthProfile,
): GenerationMode {
  const generationModeSelectors = {
    frontline: (): GenerationMode => "front",
    "adaptive-defense": (): GenerationMode =>
      hasEnemyIntrusionOnHomeSide(gameState, player) ? "rear" : "front",
  } satisfies Record<AiStrengthProfile["generationModeSelection"], () => GenerationMode>;

  return generationModeSelectors[profile.generationModeSelection]();
}

function getAffordablePieceTypes(
  player: Player,
  currentResources: number,
  pieceTypes: PieceType[],
): PieceType[] {
  return pieceTypes.filter(
    (pieceType) =>
      pieceType.config.cost <= currentResources && GameApi.canGenerate(player, pieceType),
  );
}

function countPieceTypes(gameState: GameStateSnapshot, player: Player): PieceTypeCounts {
  return gameState.pieces
    .filter((piece) => piece.player === String(player))
    .reduce(
      (counts, piece) => {
        counts[piece.pieceType] += 1;
        return counts;
      },
      {
        knight: 0,
        rook: 0,
        bishop: 0,
      },
    );
}

function filterAvailablePieceTypesForProfile(
  availablePieceTypes: PieceType[],
  pieceTypeCounts: PieceTypeCounts,
  profile: AiStrengthProfile,
): PieceType[] {
  if (profile.pieceSelection !== "knight-balanced-support") {
    return availablePieceTypes;
  }

  return availablePieceTypes.filter((pieceType) => {
    if (pieceType === PieceType.KNIGHT) {
      return true;
    }

    if (pieceTypeCounts[String(pieceType) as keyof PieceTypeCounts] >= AI_SUPPORT_PIECE_CAP) {
      return false;
    }

    return pieceTypeCounts[String(pieceType) as keyof PieceTypeCounts] <= pieceTypeCounts.knight;
  });
}

function hasEnemyIntrusionOnHomeSide(gameState: GameStateSnapshot, player: Player): boolean {
  const playerHomeBase = findHomeBase(gameState, toPlayerSnapshot(player));
  const opponentHomeBase = findHomeBase(gameState, toPlayerSnapshot(getOpponentPlayer(player)));

  if (!playerHomeBase || !opponentHomeBase) {
    return false;
  }

  return gameState.pieces.some((piece) => {
    if (piece.player === String(player)) {
      return false;
    }

    const distanceToPlayerHome = Math.abs(
      piece.panelPosition.horizontalLayer - playerHomeBase.panelPosition.horizontalLayer,
    );
    const distanceToOpponentHome = Math.abs(
      piece.panelPosition.horizontalLayer - opponentHomeBase.panelPosition.horizontalLayer,
    );

    return distanceToPlayerHome < distanceToOpponentHome;
  });
}
