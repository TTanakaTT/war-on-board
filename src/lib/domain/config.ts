// Game balance. Humans tune these values: do not change them unless asked.

export interface PieceConfig {
  iconName: string;
  cost: number;
  maxHp: number;
  attackPowerAgainstPiece: number;
  attackPowerAgainstWall: number;
  defense: number;
  /** Panels advanced per turn. Below MOVEMENT_HOP_COST, one hop takes several turns. */
  movement: number;
  attackRange: number;
  mergeable: boolean;
  /** Counts toward army power. */
  isCombatUnit: boolean;
}

// Key order is the display order.
export const PIECE_CONFIGS = {
  infantry: {
    iconName: "chess_pawn",
    cost: 8,
    maxHp: 10,
    attackPowerAgainstPiece: 5,
    attackPowerAgainstWall: 1,
    defense: 1,
    movement: 1,
    attackRange: 1,
    mergeable: true,
    isCombatUnit: true,
  },
  rook: {
    iconName: "chess_rook",
    cost: 10,
    maxHp: 10,
    attackPowerAgainstPiece: 2,
    attackPowerAgainstWall: 2,
    defense: 1,
    movement: 1,
    attackRange: 1,
    mergeable: false,
    isCombatUnit: false,
  },
  noble: {
    iconName: "chess_bishop_2",
    cost: 10,
    maxHp: 5,
    attackPowerAgainstPiece: 0,
    attackPowerAgainstWall: 0,
    defense: 0,
    movement: 1,
    attackRange: 0,
    mergeable: false,
    isCombatUnit: false,
  },
  archer: {
    iconName: "archer",
    cost: 10,
    maxHp: 8,
    attackPowerAgainstPiece: 4,
    attackPowerAgainstWall: 0,
    defense: 0,
    movement: 1,
    attackRange: 2,
    mergeable: true,
    isCombatUnit: true,
  },
  cavalry: {
    iconName: "chess_knight",
    cost: 16,
    maxHp: 12,
    attackPowerAgainstPiece: 8,
    attackPowerAgainstWall: 1,
    defense: 1,
    movement: 2,
    attackRange: 1,
    mergeable: true,
    isCombatUnit: true,
  },
  heavy: {
    iconName: "shield",
    cost: 16,
    maxHp: 20,
    attackPowerAgainstPiece: 6,
    attackPowerAgainstWall: 1,
    defense: 2,
    movement: 0.5,
    attackRange: 1,
    mergeable: true,
    isCombatUnit: true,
  },
  siege: {
    iconName: "siege",
    cost: 30,
    maxHp: 30,
    attackPowerAgainstPiece: 1,
    attackPowerAgainstWall: 5,
    defense: 3,
    movement: 1,
    attackRange: 1,
    mergeable: true,
    isCombatUnit: true,
  },
} as const satisfies Record<string, PieceConfig>;

export const HOME_BASE_INIT_RESOURCE = 5;
export const HOME_BASE_INIT_CASTLE = 10;
export const PLAYER_INIT_RESOURCE = 5;
export const DEFAULT_GAME_LAYER = 5;
export const DEFAULT_AUTOMATION_TURN_LIMIT = 100;
/** Passive growth stops at these caps but never lowers a value already above them. */
export const PASSIVE_RESOURCE_CAP = 5;
export const PASSIVE_CASTLE_CAP = 5;
export const AI_SUPPORT_PIECE_CAP = 4;
export const RESOURCE_THRESHOLD_FOR_GENERATION = 5;
export const DEFAULT_MAX_PIECES_PER_PANEL = 2;
/** Movement points per panel; banked points are capped at max(movement, MOVEMENT_HOP_COST). */
export const MOVEMENT_HOP_COST = 1;
