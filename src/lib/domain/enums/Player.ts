import { EnumClass } from "./EnumFactory";

enum PLAYER {
  SELF = "self",
  OPPONENT = "opponent",
  UNKNOWN = "unknown",
}

@EnumClass(PLAYER)
export class Player {
  static SELF: Player;
  static OPPONENT: Player;
  static UNKNOWN: Player;

  private readonly _value: PLAYER;
  constructor(value: PLAYER) {
    this._value = value;
  }
}
