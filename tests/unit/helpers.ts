import { GameApi } from "#lib/api/GameApi.ts";
import type { GameMapConfig } from "#lib/domain/config.ts";
import {
  createPiece,
  opponentOf,
  PieceType,
  Player,
  type Panel,
  type PanelPosition,
  type Piece,
  type Turn,
} from "#lib/domain/model.ts";
import { PanelRepository, PiecesRepository, TurnRepository } from "#lib/store.svelte.ts";

export { pos } from "#lib/domain/model.ts";

/** Runs a describe block once per side (player symmetry). */
export const SIDES = [Player.SELF, Player.OPPONENT] as const;

/** <terrains> are mirrored to the other half, as in a preset map. */
export function newGame(
  layer = 4,
  player: Player = Player.SELF,
  terrains: GameMapConfig["terrains"] = [],
) {
  GameApi.initializeGame({ layer, terrains });
  if (player !== Player.SELF) setTurn({ player });
}

/** Adds an Infantry (unless overridden) of <player> on <position>. */
export function add(
  id: number,
  position: PanelPosition,
  player: Player = Player.SELF,
  overrides: Partial<Piece> = {},
): Piece {
  const piece = createPiece({
    id,
    panelPosition: position,
    player,
    pieceType: PieceType.INFANTRY,
    ...overrides,
  });
  PiecesRepository.add(piece);
  return piece;
}

/** Two non-mergeable pieces without orders: a full panel at the default capacity. */
export function fill(position: PanelPosition, firstId: number, player: Player = Player.SELF) {
  add(firstId, position, player, { pieceType: PieceType.ROOK });
  add(firstId + 1, position, player, { pieceType: PieceType.NOBLE });
}

export const piece = (id: number): Piece => {
  const found = PiecesRepository.get(id);
  if (!found) throw new Error(`piece ${id} not found`);
  return found;
};

export const exists = (id: number) => PiecesRepository.get(id) !== undefined;

export const panel = (position: PanelPosition): Panel => PanelRepository.find(position)!;

export function setPanel(position: PanelPosition, changes: Partial<Panel>) {
  PanelRepository.update({ ...panel(position), ...changes });
}

export function setTurn(changes: Partial<Turn>) {
  TurnRepository.set({ ...TurnRepository.get(), ...changes });
}

export function setResources(player: Player, amount: number) {
  const turn = TurnRepository.get();
  setTurn({ resources: { ...turn.resources, [player]: amount } });
}

/** Ends the current turn and the opponent's, so <player> is to move again. */
export function endRound(player: Player) {
  GameApi.endTurn(player);
  GameApi.endTurn(opponentOf(player));
}
