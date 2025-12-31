import type { PieceType } from "$lib/domain/enums/PieceType";
import type { Player } from "$lib/domain/enums/Player";
import type { PanelPosition } from "./PanelPosition";
import { PieceService } from "../../data/services/PieceService";

export class Piece {
  id: number;
  panelPosition: PanelPosition;
  initialPosition: PanelPosition;
  player: Player;
  pieceType: PieceType;

  constructor({
    panelPosition,
    initialPosition,
    player,
    pieceType,
  }: {
    initialPosition?: PanelPosition;
    panelPosition: PanelPosition;
    player: Player;
    pieceType: PieceType;
  }) {
    // id生成をサービスに委譲
    this.id = PieceService.generateNextId();
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
