import type { Turn } from "#lib/domain/entities/Turn.ts";
import { turnState } from "#lib/data/state/TurnState.svelte.ts";

export class TurnRepository {
  static get(): Turn {
    return turnState.get();
  }
  static set(turn: Turn): void {
    turnState.set(turn);
  }
}
