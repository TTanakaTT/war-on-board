import type { Player } from "$lib/domain/enums/Player";
import type { ActionError } from "$lib/domain/enums/ActionError";
import type { GenerationMode } from "$lib/domain/entities/Turn";

/** Discriminated union for action results. */
export type Result<T = void> = { ok: true; value: T } | { ok: false; error: ActionError };

export type PlayerSnapshot = "self" | "opponent" | "unknown";

export type ControllablePlayerSnapshot = Exclude<PlayerSnapshot, "unknown">;

export type PanelStateSnapshot = "unoccupied" | "occupied";

export type PieceTypeSnapshot = "knight" | "rook" | "bishop";

export interface PanelPositionSnapshot {
  horizontalLayer: number;
  verticalLayer: number;
}

export interface PanelSnapshot {
  panelPosition: PanelPositionSnapshot;
  panelState: PanelStateSnapshot;
  player: PlayerSnapshot;
  resource: number;
  castle: number;
}

export interface PieceSnapshot {
  id: number;
  panelPosition: PanelPositionSnapshot;
  initialPosition: PanelPositionSnapshot;
  targetPosition?: PanelPositionSnapshot;
  player: ControllablePlayerSnapshot;
  pieceType: PieceTypeSnapshot;
  hp: number;
  stackCount: number;
  maxHp: number;
}

export interface HomeBaseSnapshot {
  player: ControllablePlayerSnapshot;
  panelPosition: PanelPositionSnapshot;
}

export interface TurnSnapshot {
  num: number;
  player: ControllablePlayerSnapshot;
  resources: Record<string, number>;
  maxPiecesPerPanel: Record<string, number>;
  generationMode: Record<string, GenerationMode>;
  winner: ControllablePlayerSnapshot | null;
}

export interface GameStateSnapshot {
  panels: PanelSnapshot[];
  pieces: PieceSnapshot[];
  turn: TurnSnapshot;
  homeBases: HomeBaseSnapshot[];
  layer: number;
}

export interface GameStateHistoryEntry {
  sequence: number;
  capturedAtTurn: number;
  snapshot: GameStateSnapshot;
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
