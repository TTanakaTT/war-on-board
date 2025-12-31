import { layerState } from "$lib/data/state/LayerState.svelte";

export class LayerRepository {
  static get(): number {
    return layerState.get();
  }
  static set(layer: number): void {
    layerState.set(layer);
  }
}
