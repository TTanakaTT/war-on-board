import type { PieceType } from "$lib/domain/enums/PieceType";
import type { Player } from "$lib/domain/enums/Player";
import type { PanelPosition } from "./PanelPosition";
export class Piece {
  id: number;
  panelPosition: PanelPosition;
  initialPosition: PanelPosition;
  targetPosition?: PanelPosition;
  player: Player;
  pieceType: PieceType;
  hp: number;
  /** Number of units merged into this piece. Starts at 1. */
  stackCount: number;
  /**
   * Maximum HP for this piece, accounting for merged units.
   * Equals `pieceType.config.maxHp * stackCount` after merging.
   */
  maxHp: number;

  /**
   * Effective attack power against pieces.
   * Formula: `config.attackPowerAgainstPiece + (stackCount - 1)`
   */
  get attackPowerAgainstPiece(): number {
    return this.pieceType.config.attackPowerAgainstPiece + (this.stackCount - 1);
  }

  /**
   * Effective attack power against walls.
   * Formula: `config.attackPowerAgainstWall + (stackCount - 1)`
   */
  get attackPowerAgainstWall(): number {
    return this.pieceType.config.attackPowerAgainstWall + (this.stackCount - 1);
  }

  constructor({
    id,
    panelPosition,
    initialPosition,
    targetPosition,
    player,
    pieceType,
    hp,
    stackCount,
    maxHp,
  }: {
    id?: number;
    initialPosition?: PanelPosition;
    panelPosition: PanelPosition;
    targetPosition?: PanelPosition;
    player: Player;
    pieceType: PieceType;
    hp?: number;
    stackCount?: number;
    maxHp?: number;
  }) {
    this.id = id ?? 0;
    this.panelPosition = panelPosition;
    this.initialPosition = initialPosition || panelPosition;
    this.targetPosition = targetPosition;
    this.player = player;
    this.pieceType = pieceType;
    this.stackCount = stackCount ?? 1;
    this.maxHp = maxHp ?? pieceType.config.maxHp;
    this.hp = hp ?? this.maxHp;
  }

  equals(other: Piece): boolean {
    return (
      this.panelPosition.equals(other.panelPosition) &&
      this.player === other.player &&
      this.pieceType === other.pieceType
    );
  }
}
