import type { Turn } from "$lib/domain/entities/Turn";
import { Player } from "$lib/domain/enums/Player";

let _turn = $state<Turn>({
  num: 1,
  player: Player.SELF,
  resources: {
    [String(Player.SELF)]: 0,
    [String(Player.OPPONENT)]: 0,
  },
});

export function get(): Turn {
  return _turn;
}
export function set(turn: Turn): void {
  _turn = turn;
}

export const turnState = {
  get,
  set,
};
