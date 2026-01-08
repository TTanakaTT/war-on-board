import type { Piece } from "$lib/domain/entities/Piece";
import type { Player } from "$lib/domain/enums/Player";
import type { PanelPosition } from "$lib/domain/entities/PanelPosition";
import { piecesState } from "$lib/data/state/PiecesState.svelte";

export class PiecesRepository {
  static getPiecesByPosition(panelPosition: PanelPosition): Piece[] {
    return piecesState.getByPosition(panelPosition);
  }

  static getPiecesByPlayer(player: Player): Piece[] {
    return piecesState.getPiecesByPlayer(player);
  }

  static add(piece: Piece): void {
    piecesState.add(piece);
  }

  static update(piece: Piece): void {
    piecesState.update(piece);
  }

  static remove(piece: Piece): void {
    piecesState.remove(piece);
  }

  static getAll(): Piece[] {
    return piecesState.getAll();
  }
}
