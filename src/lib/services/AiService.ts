import { Player } from "$lib/domain/enums/Player";
import { PieceType } from "$lib/domain/enums/PieceType";
import { PiecesRepository } from "$lib/data/repositories/PieceRepository";
import { TurnRepository } from "$lib/data/repositories/TurnRepository";
import { GameApi } from "$lib/api/GameApi";

export class AiService {
  /**
   * Execute an AI-controlled turn for the given player.
   *
   * 1. Assign random moves for all pieces owned by the player.
   * 2. Attempt to generate a piece if affordable.
   * 3. End the turn via GameApi.
   */
  static doAiTurn(player: Player) {
    const turn = TurnRepository.get();
    if (turn.player !== player || turn.winner) return;

    // 1. Assign moves for all pieces owned by the player
    const pieces = PiecesRepository.getPiecesByPlayer(player);
    for (const piece of pieces) {
      const targets = GameApi.getMovableTargets(piece.id);
      if (targets.length > 0) {
        const randomTarget = targets[Math.floor(Math.random() * targets.length)];
        GameApi.assignMove(player, piece.id, randomTarget);
      }
    }

    // 2. Try to generate a piece
    const currentResources = TurnRepository.get().resources[String(player)] ?? 0;
    const pieceTypes = [PieceType.KNIGHT, PieceType.BISHOP, PieceType.ROOK];
    const affordablePieceTypes = pieceTypes.filter((t) => t.config.cost <= currentResources);
    if (affordablePieceTypes.length > 0) {
      const randomPieceType =
        affordablePieceTypes[Math.floor(Math.random() * affordablePieceTypes.length)];
      GameApi.generatePiece(player, randomPieceType);
    }

    // 3. End the turn
    GameApi.endTurn(player);
  }
}
