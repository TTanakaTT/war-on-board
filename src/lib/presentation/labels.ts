import {
  AiStrength,
  Player,
  type GameMapId,
  type PieceType,
  type PieceTypeCount,
  type Side,
  type Terrain,
} from "#lib/domain/model.ts";
import type { MatchControl, PlayerController } from "#lib/domain/types.ts";
import { m } from "#lib/paraglide/messages.js";

const PIECE_LABELS: Record<PieceType, () => string> = {
  infantry: m.piece_infantry,
  rook: m.piece_rook,
  noble: m.piece_noble,
  archer: m.piece_archer,
  cavalry: m.piece_cavalry,
  heavy: m.piece_heavy,
  siege: m.piece_siege,
};

const AI_LABELS: Record<AiStrength, { level: () => string; option: () => string }> = {
  [AiStrength.STRENGTH_1]: { level: m.ai_strength_level_1, option: m.player_option_ai_strength_1 },
  [AiStrength.STRENGTH_2]: { level: m.ai_strength_level_2, option: m.player_option_ai_strength_2 },
  [AiStrength.STRENGTH_3]: { level: m.ai_strength_level_3, option: m.player_option_ai_strength_3 },
};

const MAP_LABELS: Record<GameMapId, () => string> = {
  plains: m.map_plains,
  narrows: m.map_narrows,
};

/** Plain has no label: it is the default terrain and not in the legend. */
const TERRAIN_LABELS: Record<
  Exclude<Terrain, "plain">,
  { name: () => string; effect: () => string }
> = {
  hill: { name: m.terrain_hill, effect: m.terrain_hill_effect },
  forest: { name: m.terrain_forest, effect: m.terrain_forest_effect },
  mountain: { name: m.terrain_mountain, effect: m.terrain_mountain_effect },
};

export const pieceTypeLabel = (pieceType: PieceType) => PIECE_LABELS[pieceType]();

export const mapLabel = (map: GameMapId) => MAP_LABELS[map]();

/** Terrains shown in the legend, in legend order. */
export const legendTerrains = (Object.keys(TERRAIN_LABELS) as (keyof typeof TERRAIN_LABELS)[]).map(
  (terrain) => ({
    terrain,
    name: TERRAIN_LABELS[terrain].name,
    effect: TERRAIN_LABELS[terrain].effect,
  }),
);

export const seatLabel = (player: Player) =>
  player === Player.SELF ? m.first_player_label() : m.second_player_label();

export const playerInfoOrder = (isWideLayout: boolean): [Side, Side] =>
  isWideLayout ? [Player.SELF, Player.OPPONENT] : [Player.OPPONENT, Player.SELF];

/** Controller name, numbered by seat when both sides would otherwise read the same. */
export function playerDisplayName(
  player: Player,
  controllers: Record<Side, PlayerController>,
  aiStrengths: MatchControl["aiStrengths"],
): string {
  const side: Side = player === Player.SELF ? "self" : "opponent";
  const base = (s: Side) =>
    controllers[s] === "human" ? m.player_option_human() : AI_LABELS[aiStrengths[s]].option();
  if (base("self") !== base("opponent")) return base(side);

  const index = side === "self" ? "1" : "2";
  return controllers[side] === "human"
    ? m.player_option_human_numbered({ index })
    : m.player_option_ai_strength_numbered({ index, level: AI_LABELS[aiStrengths[side]].level() });
}

/** Non-zero counts only; the first entry (0) when all are zero. */
export function visiblePieceTypeCounts(counts: readonly PieceTypeCount[]): PieceTypeCount[] {
  const nonZero = counts.filter((c) => c.count > 0);
  return nonZero.length > 0 ? nonZero : counts.slice(0, 1);
}
