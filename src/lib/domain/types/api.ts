import type { Player } from "$lib/domain/enums/Player";
import type { ActionError } from "$lib/domain/enums/ActionError";
import type { PanelState } from "$lib/domain/enums/PanelState";
import type { PieceType } from "$lib/domain/enums/PieceType";
import type { Turn } from "$lib/domain/entities/Turn";

/** Discriminated union for action results. */
export type Result<T = void> = { ok: true; value: T } | { ok: false; error: ActionError };

export interface PanelPositionSnapshot {
  horizontalLayer: number;
  verticalLayer: number;
}

export interface PanelSnapshot {
  panelPosition: PanelPositionSnapshot;
  panelState: PanelState;
  player: Player;
  resource: number;
  castle: number;
}

export interface PieceSnapshot {
  id: number;
  panelPosition: PanelPositionSnapshot;
  initialPosition: PanelPositionSnapshot;
  targetPosition?: PanelPositionSnapshot;
  player: Player;
  pieceType: PieceType;
  hp: number;
  stackCount: number;
  maxHp: number;
}

export interface HomeBaseSnapshot {
  player: Player;
  panelPosition: PanelPositionSnapshot;
}

export interface GameStateSnapshot {
  panels: PanelSnapshot[];
  pieces: PieceSnapshot[];
  turn: Turn;
  homeBases: HomeBaseSnapshot[];
  layer: number;
}

export interface GameActionResult {
  gameState: GameStateSnapshot;
}

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
export interface TurnEndResult extends GameActionResult {
  /** Combat outcomes for each target panel. */
  combatOutcomes: CombatOutcome[];
  /** The winning player, or null if the game continues. */
  winner: Player | null;
  /** The player whose turn begins next (undefined if game ended). */
  nextPlayer: Player | undefined;
}
