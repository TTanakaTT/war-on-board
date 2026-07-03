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
    mergeable: true,
  },
  [PIECETYPE.ROOK]: {
    iconName: "chess_rook",
    cost: 10,
    maxHp: 10,
    attackPowerAgainstPiece: 2,
    attackPowerAgainstWall: 2,
    defense: 1,
    mergeable: false,
  },
  [PIECETYPE.NOBLE]: {
    iconName: "chess_bishop",
    cost: 10,
    maxHp: 5,
    attackPowerAgainstPiece: 0,
    attackPowerAgainstWall: 0,
    defense: 0,
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
