import { Player } from "$lib/domain/enums/Player";
import { PieceType } from "$lib/domain/enums/PieceType";
import { PanelRepository } from "$lib/data/repositories/PanelRepository";
import { PiecesRepository } from "$lib/data/repositories/PieceRepository";
import { TurnRepository } from "$lib/data/repositories/TurnRepository";
import { GameApi } from "$lib/api/GameApi";

export class TurnAndAiService {
  static addResources(player: Player) {
    const turn = TurnRepository.get();
    const panels = PanelRepository.getAll().filter((p) => p.player === player);
    const totalResource = panels.reduce((sum, p) => sum + (p.resource || 0), 0);

    const newResources = { ...turn.resources };
    newResources[String(player)] = (newResources[String(player)] || 0) + totalResource;

    TurnRepository.set({ ...turn, resources: newResources });
  }

  /**
   * Execute the AI opponent's turn.
   *
   * 1. Assign random moves for all opponent pieces.
   * 2. Attempt to generate a piece if affordable.
   * 3. End the turn via GameApi.
   */
  static doOpponentTurn() {
    const turn = TurnRepository.get();
    if (turn.player !== Player.OPPONENT || turn.winner) return;

    // 1. Assign moves for all opponent pieces
    const opponentPieces = PiecesRepository.getPiecesByPlayer(Player.OPPONENT);
    for (const piece of opponentPieces) {
      const targets = GameApi.getMovableTargets(piece.id);
      if (targets.length > 0) {
        const randomTarget = targets[Math.floor(Math.random() * targets.length)];
        GameApi.assignMove(Player.OPPONENT, piece.id, randomTarget);
      }
    }

    // 2. Try to generate a piece
    const currentResources = TurnRepository.get().resources[String(Player.OPPONENT)] ?? 0;
    const pieceTypes = [PieceType.KNIGHT, PieceType.BISHOP, PieceType.ROOK];
    const affordablePieceTypes = pieceTypes.filter((t) => t.config.cost <= currentResources);
    if (affordablePieceTypes.length > 0) {
      const randomPieceType =
        affordablePieceTypes[Math.floor(Math.random() * affordablePieceTypes.length)];
      GameApi.generatePiece(Player.OPPONENT, randomPieceType);
    }

    // 3. End the opponent's turn
    GameApi.endTurn(Player.OPPONENT);
  }
}
