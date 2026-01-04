import { EnumClass } from "./EnumFactory";

enum PIECETYPE {
  KNIGHT = "knight",
  ROOK = "rook",
  BISHOP = "bishop",
}

@EnumClass(PIECETYPE)
export class PieceType {
  static KNIGHT: PieceType;
  static ROOK: PieceType;
  static BISHOP: PieceType;

  private readonly _value: PIECETYPE;
  constructor(value: PIECETYPE) {
    this._value = value;
  }

  getIconName(): string {
    switch (this._value) {
      case PIECETYPE.ROOK:
        return "chess_rook";
      case PIECETYPE.BISHOP:
        return "chess_bishop";
      case PIECETYPE.KNIGHT:
      default:
        return "chess_knight";
    }
  }

  getCost(): number {
    switch (this._value) {
      case PIECETYPE.ROOK:
        return 5;
      case PIECETYPE.BISHOP:
        return 5;
      case PIECETYPE.KNIGHT:
      default:
        return 4;
    }
  }
}
