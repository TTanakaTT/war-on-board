import type { PieceType } from "$lib/domain/enums/PieceType";
import type { Player } from "$lib/domain/enums/Player";
import type { PanelPosition } from "./PanelPosition";
import { PieceService } from "../../data/services/PieceService";

export class Piece {
  id: number;
  panelPosition: PanelPosition;
  player: Player;
  pieceType: PieceType;

  constructor({
    panelPosition,
    player,
    pieceType,
  }: {
    panelPosition: PanelPosition;
    player: Player;
    pieceType: PieceType;
  }) {
    // id生成をサービスに委譲
    this.id = PieceService.generateNextId();
    this.panelPosition = panelPosition;
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
