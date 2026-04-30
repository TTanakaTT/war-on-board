import { Player } from "$lib/domain/enums/Player";
import type { GameStateSnapshot, PieceSnapshot } from "$lib/domain/types/api";
import { findPanel } from "$lib/services/ai/stateUtils";

export function scoreBoardState(gameState: GameStateSnapshot, player: Player): number {
  const playerId = String(player);
  const opponentId = String(player === Player.SELF ? Player.OPPONENT : Player.SELF);

  if (gameState.turn.winner === playerId) {
    return 5000;
  }

  if (gameState.turn.winner === opponentId) {
    return -5000;
  }

  const pieceScore = gameState.pieces.reduce((score, piece) => {
    const direction = piece.player === playerId ? 1 : -1;
    return score + direction * scorePieceValue(piece);
  }, 0);

  const panelScore = gameState.panels.reduce((score, panel) => {
    if (panel.player === playerId) {
      return score + 8 + panel.resource * 4 + panel.castle * 2;
    }

    if (panel.player === opponentId) {
      return score - (8 + panel.resource * 4 + panel.castle * 2);
    }

    return score;
  }, 0);

  const homeBaseScore = gameState.homeBases.reduce((score, homeBase) => {
    const panel = findPanel(gameState, homeBase.panelPosition);
    if (!panel) {
      return score;
    }

    if (homeBase.player === playerId) {
      return score + panel.castle * 3;
    }

    return score - panel.castle * 3;
  }, 0);

  return pieceScore + panelScore + homeBaseScore;
}

function scorePieceValue(piece: PieceSnapshot): number {
  const typeValue = piece.pieceType === "rook" ? 18 : piece.pieceType === "knight" ? 16 : 12;

  return typeValue + piece.hp * 2 + piece.stackCount * 3;
}
