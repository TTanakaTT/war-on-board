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
  /** HP may become fractional after wall-overflow damage. */
  hp: number;
  /** Number of units merged into this piece. Starts at 1. */
  stackCount: number;
  /**
   * Maximum HP for this piece, accounting for merged units.
   * Equals `pieceType.config.maxHp * stackCount` after merging.
   */
  maxHp: number;
  /**
   * Banked movement points. Accrues by `pieceType.config.movement` each turn
   * (capped — see PieceService.computeAccruedMovementPoints) and is spent
   * when the piece advances a panel. Not scaled by merge/stackCount.
   */
  movementPoints: number;

  /**
   * Base attack power against pieces (raw pieceType.config value).
   * Merge does not raise this — CombatService multiplies it by stackCount
   * (hit count) and subtracts the target's defense to compute damage.
   */
  get attackPowerAgainstPiece(): number {
    return this.pieceType.config.attackPowerAgainstPiece;
  }

  /**
   * Effective attack power against walls.
   * Walls have no defense stat, so merge scales this directly.
   * Formula: `config.attackPowerAgainstWall * stackCount`
   */
  get attackPowerAgainstWall(): number {
    return this.pieceType.config.attackPowerAgainstWall * this.stackCount;
  }

  /** Defense stat, forwarded from pieceType.config. Unaffected by merge/stackCount. */
  get defense(): number {
    return this.pieceType.config.defense;
  }

  /** Attack range stat, forwarded from pieceType.config. Unaffected by merge/stackCount. */
  get attackRange(): number {
    return this.pieceType.config.attackRange;
  }

  /**
   * Whether this piece can attack (i.e. move to enemy panels).
   * A piece with 0 attack power against both pieces and walls cannot attack.
   */
  get canAttack(): boolean {
    return this.attackPowerAgainstPiece > 0 || this.attackPowerAgainstWall > 0;
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
    movementPoints,
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
    movementPoints?: number;
  }) {
    this.id = id ?? 0;
    this.panelPosition = panelPosition;
    this.initialPosition = initialPosition || panelPosition;
    this.targetPosition = targetPosition;
    this.player = player;
    this.pieceType = pieceType;
    this.stackCount = stackCount ?? 1;
    this.maxHp = maxHp ?? pieceType.config.maxHp * this.stackCount;
    this.hp = hp ?? this.maxHp;
    this.movementPoints = movementPoints ?? pieceType.config.movement;
  }

  equals(other: Piece): boolean {
    return (
      this.panelPosition.equals(other.panelPosition) &&
      this.player === other.player &&
      this.pieceType === other.pieceType
    );
  }
}
