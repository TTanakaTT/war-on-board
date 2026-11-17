import type { PieceType } from "$lib/domain/enums/PieceType";
import type { Player } from "$lib/domain/enums/Player";
import type { PanelPosition } from "./PanelPosition";
import { MOVEMENT_HOP_COST } from "$lib/domain/constants/GameConstants";
export class Piece {
  id: number;
  panelPosition: PanelPosition;
  initialPosition: PanelPosition;
  targetPosition?: PanelPosition;
  /**
   * Pending ranged-attack target (see GameApi.assignRangedAttack). Distinct
   * from targetPosition since a ranged attack never moves the piece — it
   * resolves in place via PieceService.resolveRangedAttacks.
   */
  rangedAttackTargetPosition?: PanelPosition;
  /**
   * Set while this piece is between panels: it has left `panelPosition` toward the
   * adjacent `transitPosition` but has not arrived yet (see `takesMultipleTurnsPerHop`).
   * The piece still belongs to `panelPosition` — it defends that panel, applies its
   * passive effect there and counts there for the capacity invariant — while its own
   * side also treats `transitPosition` as taken (see
   * MovementRulesService.endOfTurnOccupancy). `movementPoints` holds the progress made
   * along the hop.
   */
  transitPosition?: PanelPosition;
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
   *
   * For a piece that takes multiple turns per hop (see `takesMultipleTurnsPerHop`),
   * this is instead the progress toward its current hop or attack: reset to 0 when it
   * is given an order, advanced by `movement` at the end of each of its owner's turns
   * (see PieceService.finalizePlayerMoves), and never banked while idle.
   */
  movementPoints: number;
  /**
   * Order sequence: when this piece was given its current move order, numbered across both
   * sides (see GameApi.assignMove). Set only by assignMove and kept through resolution,
   * cancellation and merging. When attackers capture a panel, lower numbers enter first
   * (see PieceService.resolveTargetPanel). Undefined for a piece never given an order.
   */
  orderSequence?: number;

  /**
   * Whether one hop takes this piece more than one turn (movement below
   * MOVEMENT_HOP_COST). Such a piece moves between panels over several turns (see
   * `transitPosition`) and winds an attack up over several turns.
   */
  get takesMultipleTurnsPerHop(): boolean {
    return this.pieceType.config.movement < MOVEMENT_HOP_COST;
  }

  /** Whether this piece is between `panelPosition` and `transitPosition`. */
  get isInTransit(): boolean {
    return this.transitPosition !== undefined;
  }

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
    rangedAttackTargetPosition,
    transitPosition,
    player,
    pieceType,
    hp,
    stackCount,
    maxHp,
    movementPoints,
    orderSequence,
  }: {
    id?: number;
    initialPosition?: PanelPosition;
    panelPosition: PanelPosition;
    targetPosition?: PanelPosition;
    rangedAttackTargetPosition?: PanelPosition;
    transitPosition?: PanelPosition;
    player: Player;
    pieceType: PieceType;
    hp?: number;
    stackCount?: number;
    maxHp?: number;
    movementPoints?: number;
    orderSequence?: number;
  }) {
    this.id = id ?? 0;
    this.panelPosition = panelPosition;
    this.initialPosition = initialPosition || panelPosition;
    this.targetPosition = targetPosition;
    this.rangedAttackTargetPosition = rangedAttackTargetPosition;
    this.transitPosition = transitPosition;
    this.player = player;
    this.pieceType = pieceType;
    this.stackCount = stackCount ?? 1;
    this.maxHp = maxHp ?? pieceType.config.maxHp * this.stackCount;
    this.hp = hp ?? this.maxHp;
    this.movementPoints = movementPoints ?? pieceType.config.movement;
    this.orderSequence = orderSequence;
  }

  equals(other: Piece): boolean {
    return (
      this.panelPosition.equals(other.panelPosition) &&
      this.player === other.player &&
      this.pieceType === other.pieceType
    );
  }
}
