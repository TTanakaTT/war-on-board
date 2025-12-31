import { Piece } from "$lib/domain/entities/Piece";
import { PiecesRepository } from "$lib/data/repositories/PieceRepository";
import type { PanelPosition } from "$lib/domain/entities/PanelPosition";
import type { Player } from "$lib/domain/enums/Player";

export class PieceService {
  static find(panelPosition: PanelPosition): Piece | undefined {
    const pieces = PiecesRepository.getAll();
    return pieces.find((x: Piece) => x.panelPosition.equals(panelPosition));
  }

  static findByPlayer(player: Player): Piece | undefined {
    const pieces = PiecesRepository.getAll();
    return pieces.find((x: Piece) => x.player === player);
  }

  static generateNextId(): number {
    return (
      PiecesRepository.getAll().reduce((max: number, piece: Piece) => Math.max(max, piece.id), 0) +
      1
    );
  }

  static move(panelPosition: PanelPosition, selectedPiece: Piece) {
    const newPiece = new Piece({
      id: selectedPiece.id,
      panelPosition: panelPosition,
      initialPosition: selectedPiece.initialPosition,
      player: selectedPiece.player,
      pieceType: selectedPiece.pieceType,
    });
    PiecesRepository.update(newPiece);
  }
}
