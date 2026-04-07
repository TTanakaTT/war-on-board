import type { HomeBase } from "$lib/domain/entities/HomeBase";
import type { Player } from "$lib/domain/enums/Player";

const _homeBases = $state<HomeBase[]>([]);

function getAll(): HomeBase[] {
  return _homeBases;
}

function getByPlayer(player: Player): HomeBase | undefined {
  return _homeBases.find((hb) => hb.player === player);
}

function setAll(homeBases: HomeBase[]): void {
  _homeBases.splice(0, _homeBases.length, ...homeBases);
}

export const homeBaseState = {
  getAll,
  getByPlayer,
  setAll,
};
