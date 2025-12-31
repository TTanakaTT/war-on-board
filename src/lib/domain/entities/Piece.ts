import type { PieceType } from "$lib/domain/enums/PieceType";
import type { Player } from "$lib/domain/enums/Player";
import type { PanelPosition } from "./PanelPosition";
export class Piece {
  id: number;
  panelPosition: PanelPosition;
  initialPosition: PanelPosition;
  player: Player;
  pieceType: PieceType;

  constructor({
    id,
    panelPosition,
    initialPosition,
    player,
    pieceType,
  }: {
    id?: number;
    initialPosition?: PanelPosition;
    panelPosition: PanelPosition;
    player: Player;
    pieceType: PieceType;
  }) {
    this.id = id ?? 0;
    this.panelPosition = panelPosition;
    this.initialPosition = initialPosition || panelPosition;
    this.player = player;
    this.pieceType = pieceType;
  }

  equals(other: Piece): boolean {
    return (
      this.panelPosition.equals(other.panelPosition) &&
      this.player === other.player &&
      this.pieceType === other.pieceType
    );
  }
}
