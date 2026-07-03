import { EnumClass } from "./EnumFactory";

enum PIECETYPE {
  INFANTRY = "infantry",
  ROOK = "rook",
  NOBLE = "noble",
}

interface PieceConfig {
  readonly iconName: string;
  readonly cost: number;
  readonly maxHp: number;
  readonly attackPowerAgainstPiece: number;
  readonly attackPowerAgainstWall: number;
  readonly defense: number;
  /**
   * Panels advanced toward a piece's target position per turn. Movement points
   * accrue each turn up to max(movement, MOVEMENT_HOP_COST) — see
   * PieceService.computeAccruedMovementPoints — and merge does not scale it.
   */
  readonly movement: number;
  /**
   * Panel distance at which this piece can deal and receive combat damage.
   * A defender only counterattacks if its own attackRange reaches the actual
   * distance to its attacker — see CombatService.resolveCombat. Not scaled
   * by merge/stackCount.
   */
  readonly attackRange: number;
  /**
   * Whether units of this type can merge when multiple occupy the same panel.
   * Merging sums HP, maxHp, stackCount. Merge multiplies attack *count*, not
   * attack power — see Piece.attackPowerAgainstPiece/attackPowerAgainstWall.
   */
  readonly mergeable: boolean;
}

const CONFIGS: Record<PIECETYPE, PieceConfig> = {
  [PIECETYPE.INFANTRY]: {
    iconName: "chess_knight",
    cost: 8,
    maxHp: 10,
    attackPowerAgainstPiece: 5,
    attackPowerAgainstWall: 1,
    defense: 1,
    movement: 1,
    attackRange: 1,
    mergeable: true,
  },
  [PIECETYPE.ROOK]: {
    iconName: "chess_rook",
    cost: 10,
    maxHp: 10,
    attackPowerAgainstPiece: 2,
    attackPowerAgainstWall: 2,
    defense: 1,
    movement: 1,
    attackRange: 1,
    mergeable: false,
  },
  [PIECETYPE.NOBLE]: {
    iconName: "chess_bishop",
    cost: 10,
    maxHp: 5,
    attackPowerAgainstPiece: 0,
    attackPowerAgainstWall: 0,
    defense: 0,
    movement: 1,
    attackRange: 0,
    mergeable: false,
  },
} as const;

@EnumClass(PIECETYPE)
export class PieceType {
  static INFANTRY: PieceType;
  static ROOK: PieceType;
  static NOBLE: PieceType;

  private readonly _value: PIECETYPE;
  constructor(value: PIECETYPE) {
    this._value = value;
  }

  get config(): PieceConfig {
    return CONFIGS[this._value];
  }
}
