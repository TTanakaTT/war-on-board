import type { Player } from "$lib/domain/enums/Player";
import type { ActionError } from "$lib/domain/enums/ActionError";

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
