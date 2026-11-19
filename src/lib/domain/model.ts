import { MOVEMENT_HOP_COST, PIECE_CONFIGS } from "#lib/domain/config.ts";

type ValueOf<T> = T[keyof T];

export const Player = { SELF: "self", OPPONENT: "opponent", UNKNOWN: "unknown" } as const;
export type Player = ValueOf<typeof Player>;
/** A player that can own pieces and take turns. */
export type Side = Exclude<Player, "unknown">;
export const SIDES: readonly Side[] = [Player.SELF, Player.OPPONENT];
export const opponentOf = (player: Player): Side =>
  player === Player.SELF ? Player.OPPONENT : Player.SELF;

export type PieceType = keyof typeof PIECE_CONFIGS;
export const PieceType = {
  INFANTRY: "infantry",
  ROOK: "rook",
  NOBLE: "noble",
  ARCHER: "archer",
  CAVALRY: "cavalry",
  HEAVY: "heavy",
  SIEGE: "siege",
} as const satisfies Record<string, PieceType>;
/** Every piece type in display order. */
export const PIECE_TYPES = Object.keys(PIECE_CONFIGS) as PieceType[];
export const pieceConfig = (pieceType: PieceType) => PIECE_CONFIGS[pieceType];

/** OCCUPIED/UNOCCUPIED are game state; the rest are UI highlights, dropped from snapshots. */
export const PanelState = {
  UNOCCUPIED: "unoccupied",
  OCCUPIED: "occupied",
  SELECTED: "selected",
  MOVABLE: "movable",
} as const;
export type PanelState = ValueOf<typeof PanelState>;

export const AiStrength = {
  STRENGTH_1: "strength1",
  STRENGTH_2: "strength2",
  STRENGTH_3: "strength3",
} as const;
export type AiStrength = ValueOf<typeof AiStrength>;

export const ActionError = {
  NOT_YOUR_TURN: "NOT_YOUR_TURN",
  PIECE_NOT_FOUND: "PIECE_NOT_FOUND",
  PIECE_NOT_OWNED: "PIECE_NOT_OWNED",
  TARGET_NOT_REACHABLE: "TARGET_NOT_REACHABLE",
  /** A pending order cannot be redirected yet (see GameApi.assignMove). */
  INSUFFICIENT_MOVEMENT_POINTS: "INSUFFICIENT_MOVEMENT_POINTS",
  INSUFFICIENT_RESOURCES: "INSUFFICIENT_RESOURCES",
  NO_GENERATION_PANEL: "NO_GENERATION_PANEL",
  CANNOT_CANCEL: "CANNOT_CANCEL",
  GAME_ALREADY_OVER: "GAME_ALREADY_OVER",
  INVALID_GAME_STATE: "INVALID_GAME_STATE",
  TEMPORARY_GAME_STATE_CALLBACK_FAILED: "TEMPORARY_GAME_STATE_CALLBACK_FAILED",
  TEMPORARY_GAME_STATE_RESTORE_FAILED: "TEMPORARY_GAME_STATE_RESTORE_FAILED",
} as const;
export type ActionError = ValueOf<typeof ActionError>;

export type Result<T = void> = { ok: true; value: T } | { ok: false; error: ActionError };

export type GenerationMode = "front" | "rear";

export interface PanelPosition {
  horizontalLayer: number;
  verticalLayer: number;
}

export interface Panel {
  panelPosition: PanelPosition;
  panelState: PanelState;
  player: Player;
  resource: number;
  wall: number;
}

export interface Piece {
  id: number;
  panelPosition: PanelPosition;
  /** Where the piece stood at the start of its owner's turn. */
  initialPosition: PanelPosition;
  targetPosition?: PanelPosition;
  /** Pending ranged attack; the piece fires from where it stands. */
  rangedAttackTargetPosition?: PanelPosition;
  /**
   * Set while a slow piece is moving into this adjacent panel. It still belongs to
   * panelPosition (defends it, applies its passive there) and its side also counts it here.
   */
  transitPosition?: PanelPosition;
  player: Player;
  pieceType: PieceType;
  /** May be fractional after proportional damage. */
  hp: number;
  /** Units merged into this piece. */
  stackCount: number;
  maxHp: number;
  /** Banked movement points; for a slow piece, progress of its current hop or attack. */
  movementPoints: number;
  /** When the current order was given, across both sides. Lower enters a captured panel first. */
  orderSequence?: number;
}

export interface HomeBase {
  player: Player;
  panelPosition: PanelPosition;
}

export interface Turn {
  num: number;
  player: Player;
  resources: Record<string, number>;
  maxPiecesPerPanel: Record<string, number>;
  generationMode: Record<string, GenerationMode>;
  winner: Player | null;
}

/** Plain JSON copy of the whole game. Panel states are only occupied/unoccupied. */
export interface GameState {
  panels: Panel[];
  pieces: Piece[];
  turn: Turn;
  homeBases: HomeBase[];
  layer: number;
}

export interface CombatOutcome {
  targetPosition: PanelPosition;
  destroyedPieceIds: number[];
  entered: boolean;
  wallDamageDealt: number;
}

export interface GameActionResult {
  gameState: GameState;
}

export interface TurnEndResult extends GameActionResult {
  combatOutcomes: CombatOutcome[];
  winner: Player | null;
  nextPlayer: Player | undefined;
}

/** `progress` (0–1) of the way from panel `from` to adjacent panel `to`. */
export interface BoardPoint {
  from: PanelPosition;
  to: PanelPosition;
  progress: number;
}

export const pos = (horizontalLayer: number, verticalLayer: number): PanelPosition => ({
  horizontalLayer,
  verticalLayer,
});

export const posKey = (p: PanelPosition): string => `${p.horizontalLayer},${p.verticalLayer}`;

export const samePos = (a?: PanelPosition | null, b?: PanelPosition | null): boolean =>
  !!a && !!b && a.horizontalLayer === b.horizontalLayer && a.verticalLayer === b.verticalLayer;

export const isAdjacent = (a: PanelPosition, b: PanelPosition): boolean =>
  !samePos(a, b) &&
  Math.abs(a.horizontalLayer - b.horizontalLayer) <= 1 &&
  Math.abs(a.verticalLayer - b.verticalLayer) <= 1 &&
  Math.abs(
    Math.abs(a.horizontalLayer) - Math.abs(b.horizontalLayer) + a.verticalLayer - b.verticalLayer,
  ) <= 1;

export function createPanel(init: Pick<Panel, "panelPosition"> & Partial<Panel>): Panel {
  return {
    panelState: PanelState.UNOCCUPIED,
    player: Player.UNKNOWN,
    resource: 0,
    wall: 0,
    ...init,
  };
}

export function createPiece(
  init: Pick<Piece, "panelPosition" | "player" | "pieceType"> & Partial<Piece>,
): Piece {
  const config = pieceConfig(init.pieceType);
  const stackCount = init.stackCount ?? 1;
  const maxHp = init.maxHp ?? config.maxHp * stackCount;
  return {
    ...init,
    id: init.id ?? 0,
    initialPosition: init.initialPosition ?? init.panelPosition,
    stackCount,
    maxHp,
    hp: init.hp ?? maxHp,
    movementPoints: init.movementPoints ?? config.movement,
  };
}

/** Movement below MOVEMENT_HOP_COST: each hop or attack takes several turns. */
export const takesMultipleTurnsPerHop = (piece: Piece): boolean =>
  pieceConfig(piece.pieceType).movement < MOVEMENT_HOP_COST;

export const isInTransit = (piece: Piece): boolean => piece.transitPosition !== undefined;

/** Merge multiplies wall damage directly; piece damage is multiplied in CombatService. */
export const wallAttackPower = (piece: Piece): number =>
  pieceConfig(piece.pieceType).attackPowerAgainstWall * piece.stackCount;

export const canAttack = (piece: Piece): boolean => {
  const config = pieceConfig(piece.pieceType);
  return config.attackPowerAgainstPiece > 0 || config.attackPowerAgainstWall > 0;
};

export interface PieceTypeCount {
  pieceType: PieceType;
  count: number;
}

const COMBAT_UNIT_TYPES = PIECE_TYPES.filter((type) => pieceConfig(type).isCombatUnit);

/** A merged piece counts as its stackCount. */
export const liveCombatUnitCounts = (pieces: readonly Piece[]): PieceTypeCount[] =>
  COMBAT_UNIT_TYPES.map((pieceType) => ({
    pieceType,
    count: pieces
      .filter((p) => p.pieceType === pieceType)
      .reduce((sum, p) => sum + p.stackCount, 0),
  }));

export const lostCombatUnitCounts = (lost: Record<PieceType, number>): PieceTypeCount[] =>
  COMBAT_UNIT_TYPES.map((pieceType) => ({ pieceType, count: lost[pieceType] }));

/** Total cost of the units. */
export const armyPower = (counts: readonly PieceTypeCount[]) =>
  counts.reduce((sum, c) => sum + pieceConfig(c.pieceType).cost * c.count, 0);
