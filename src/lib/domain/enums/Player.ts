import { EnumClass } from "./EnumFactory";

enum PLAYER {
  SELF = "self",
  OPPONENT = "opponent",
  UNKNOWN = "unknown",
}

class Player {
  static SELF: Player;
  static OPPONENT: Player;
  static UNKNOWN: Player;

  private readonly _value: PLAYER;
  constructor(value: PLAYER) {
    this._value = value;
  }
}

EnumClass(PLAYER)(Player);

export { Player };
