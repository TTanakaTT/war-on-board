/** Error codes returned by GameApi actions when a precondition is not met. */
export enum ActionError {
  /** The acting player is not the current turn player. */
  NOT_YOUR_TURN = "NOT_YOUR_TURN",

  /** No piece with the given ID exists. */
  PIECE_NOT_FOUND = "PIECE_NOT_FOUND",

  /** The piece belongs to another player. */
  PIECE_NOT_OWNED = "PIECE_NOT_OWNED",

  /** The target panel is not reachable (not adjacent, or capacity exceeded). */
  TARGET_NOT_REACHABLE = "TARGET_NOT_REACHABLE",

  /** The player does not have enough resources to perform this action. */
  INSUFFICIENT_RESOURCES = "INSUFFICIENT_RESOURCES",

  /** No panel meets the generation requirements. */
  NO_GENERATION_PANEL = "NO_GENERATION_PANEL",

  /** The move cannot be cancelled (no pending move, or would exceed panel capacity). */
  CANNOT_CANCEL = "CANNOT_CANCEL",

  /** The game has already ended (a winner exists). */
  GAME_ALREADY_OVER = "GAME_ALREADY_OVER",
}
