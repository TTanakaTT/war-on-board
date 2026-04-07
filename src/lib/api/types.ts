import type { Player } from "$lib/domain/enums/Player";

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

/** Discriminated union for action results. */
export type Result<T = void> = { ok: true; value: T } | { ok: false; error: ActionError };

/** Outcome of a single combat group (attackers targeting one panel). */
export interface CombatOutcome {
  targetPosition: { horizontalLayer: number; verticalLayer: number };
  /** IDs of pieces destroyed in this combat. */
  destroyedPieceIds: number[];
  /** Whether attackers successfully entered the target panel. */
  entered: boolean;
  /** Wall damage dealt (0 if no wall). */
  wallDamageDealt: number;
}

/** Result payload returned by `endTurn`. */
export interface TurnEndResult {
  /** Combat outcomes for each target panel. */
  combatOutcomes: CombatOutcome[];
  /** The winning player, or null if the game continues. */
  winner: Player | null;
  /** The player whose turn begins next (undefined if game ended). */
  nextPlayer: Player | undefined;
}
