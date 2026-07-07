import { rangedAttackModeState } from "$lib/data/state/RangedAttackModeState.svelte";

export class RangedAttackModeRepository {
  static isActive(): boolean {
    return rangedAttackModeState.isActive();
  }

  static set(active: boolean): void {
    rangedAttackModeState.set(active);
  }
}
