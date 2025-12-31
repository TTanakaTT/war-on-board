import ChessKnight from "svelte-material-icons/ChessKnight.svelte";
import ChessRook from "svelte-material-icons/ChessRook.svelte";
import ChessBishop from "svelte-material-icons/ChessBishop.svelte";
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

  getComponent() {
    switch (this._value) {
      case PIECETYPE.ROOK:
        return ChessRook;
      case PIECETYPE.BISHOP:
        return ChessBishop;
      case PIECETYPE.KNIGHT:
      default:
        return ChessKnight;
    }
  }
}
