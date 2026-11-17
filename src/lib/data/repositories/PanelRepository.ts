import type { Panel } from "#lib/domain/entities/Panel.ts";
import type { PanelPosition } from "#lib/domain/entities/PanelPosition.ts";
import { panelsState } from "#lib/data/state/PanelsState.svelte.ts";

export class PanelRepository {
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
}
