import { Player } from "$lib/domain/enums/Player";
import type {
  GameStateSnapshot,
  HomeBaseSnapshot,
  PanelPositionSnapshot,
  PanelSnapshot,
  PieceSnapshot,
} from "$lib/domain/types/api";

type PositionLike = PanelPositionSnapshot | { horizontalLayer: number; verticalLayer: number };

export function positionEquals(left: PositionLike, right: PositionLike): boolean {
  return (
    left.horizontalLayer === right.horizontalLayer && left.verticalLayer === right.verticalLayer
  );
}

export function findPanel(
  gameState: GameStateSnapshot,
  target: PositionLike,
): PanelSnapshot | undefined {
  return gameState.panels.find((panel) => positionEquals(panel.panelPosition, target));
}

export function findHomeBase(
  gameState: GameStateSnapshot,
  player: HomeBaseSnapshot["player"],
): HomeBaseSnapshot | undefined {
  return gameState.homeBases.find((homeBase) => homeBase.player === player);
}

export function getOpponentPlayer(player: Player): Player {
  return player === Player.SELF ? Player.OPPONENT : Player.SELF;
}

export function toPlayerSnapshot(player: Player): HomeBaseSnapshot["player"] {
  return player === Player.SELF ? "self" : "opponent";
}

export function isEnemyHomeBase(
  gameState: GameStateSnapshot,
  player: PieceSnapshot["player"],
  target: PositionLike,
): boolean {
  return gameState.homeBases.some(
    (homeBase) => homeBase.player !== player && positionEquals(homeBase.panelPosition, target),
  );
}

export function getHomeDistance(
  gameState: GameStateSnapshot,
  player: PieceSnapshot["player"],
  position: PositionLike,
): number {
  const homeBase = findHomeBase(gameState, player);
  if (!homeBase) {
    return Number.MAX_SAFE_INTEGER;
  }

  return Math.abs(position.horizontalLayer - homeBase.panelPosition.horizontalLayer);
}

export function getEnemyHomeDistance(
  gameState: GameStateSnapshot,
  player: PieceSnapshot["player"],
  position: PositionLike,
): number {
  const enemyHomeBase = gameState.homeBases.find((homeBase) => homeBase.player !== player);
  if (!enemyHomeBase) {
    return Number.MAX_SAFE_INTEGER;
  }

  return Math.abs(position.horizontalLayer - enemyHomeBase.panelPosition.horizontalLayer);
}
