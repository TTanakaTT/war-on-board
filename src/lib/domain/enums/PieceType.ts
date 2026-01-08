import { EnumClass } from "./EnumFactory";

enum PIECETYPE {
  KNIGHT = "knight",
  ROOK = "rook",
  BISHOP = "bishop",
}

interface PieceConfig {
  readonly iconName: string;
  readonly cost: number;
  readonly maxHp: number;
  readonly attackPowerAgainstPiece: number;
  readonly attackPowerAgainstWall: number;
}

const CONFIGS: Record<PIECETYPE, PieceConfig> = {
  [PIECETYPE.KNIGHT]: {
    iconName: "chess_knight",
    cost: 4,
    maxHp: 10,
    attackPowerAgainstPiece: 5,
    attackPowerAgainstWall: 2,
  },
  [PIECETYPE.ROOK]: {
    iconName: "chess_rook",
    cost: 5,
    maxHp: 10,
    attackPowerAgainstPiece: 0,
    attackPowerAgainstWall: 2,
  },
  [PIECETYPE.BISHOP]: {
    iconName: "chess_bishop",
    cost: 5,
    maxHp: 5,
    attackPowerAgainstPiece: 0,
    attackPowerAgainstWall: 0,
  },
} as const;

@EnumClass(PIECETYPE)
export class PieceType {
  static KNIGHT: PieceType;
  static ROOK: PieceType;
  static BISHOP: PieceType;

  private readonly _value: PIECETYPE;
  constructor(value: PIECETYPE) {
    this._value = value;
  }

  get config(): PieceConfig {
    return CONFIGS[this._value];
  }
}
