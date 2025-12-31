import type { Player } from "$lib/domain/enums/Player";

export interface Turn {
  num: number;
  player: Player;
}
