import type { HomeBase } from "#lib/domain/entities/HomeBase.ts";
import type { Player } from "#lib/domain/enums/Player.ts";
import { homeBaseState } from "#lib/data/state/HomeBaseState.svelte.ts";

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
