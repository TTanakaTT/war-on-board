import type { Panel } from "$lib/domain/entities/Panel";
import type { PanelPosition } from "$lib/domain/entities/PanelPosition";
import type { PanelState } from "$lib/domain/enums/PanelState";
import { panelsState } from "$lib/presentation/state/PanelsState.svelte";

export class PanelRepository {
  static initialize(layer: number): void {
    panelsState.initialize(layer);
  }

  static getAll(): Panel[] {
    return panelsState.getAll();
  }

  static setAll(panels: Panel[]): void {
    panelsState.setAll(panels);
  }

  static update(panel: Panel): void {
    panelsState.update(panel);
  }

  static remove(panel: Panel): void {
    panelsState.remove(panel);
  }

  static find(panelPosition: PanelPosition): Panel | undefined {
    return this.getAll().find((x) => x.panelPosition.equals(panelPosition));
  }

  static findPanelState(panelPosition: PanelPosition): PanelState | undefined {
    return this.find(panelPosition)?.panelState;
  }
}
