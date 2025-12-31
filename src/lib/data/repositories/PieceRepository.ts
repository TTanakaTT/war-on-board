import type { Piece } from "$lib/domain/entities/Piece";
import type { Player } from "$lib/domain/enums/Player";
import type { PanelPosition } from "$lib/domain/entities/PanelPosition";
import { piecesState } from "$lib/presentation/state/PiecesState.svelte";

export class PiecesRepository {
  static getPiecesByPosition(panelPosition: PanelPosition): Piece[] {
    return piecesState.getByPosition(panelPosition);
  }

  static getPiecesByPlayer(player: Player): Piece[] {
    return piecesState.getPiecesByPlayer(player);
  }
}
