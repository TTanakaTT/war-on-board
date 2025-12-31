import type { Panel } from "$lib/domain/entities/Panel";
import { selectedPanelState } from "$lib/data/state/SelectedPanelState.svelte";

export class SelectedPanelRepository {
  static get(): Panel | undefined {
    return selectedPanelState.get();
  }
  static set(panel: Panel | undefined): void {
    selectedPanelState.set(panel);
  }
}
