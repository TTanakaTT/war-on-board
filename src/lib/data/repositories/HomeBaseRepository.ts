import type { HomeBase } from "$lib/domain/entities/HomeBase";
import type { Player } from "$lib/domain/enums/Player";
import { homeBaseState } from "$lib/data/state/HomeBaseState.svelte";

export class HomeBaseRepository {
  static getAll(): HomeBase[] {
    return homeBaseState.getAll();
  }

  static getByPlayer(player: Player): HomeBase | undefined {
    return homeBaseState.getByPlayer(player);
  }

  static setAll(homeBases: HomeBase[]): void {
    homeBaseState.setAll(homeBases);
  }
}
