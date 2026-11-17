import type { Panel } from "#lib/domain/entities/Panel.ts";
import { selectedPanelState } from "#lib/data/state/SelectedPanelState.svelte.ts";

export class SelectedPanelRepository {
  static get(): Panel | undefined {
    return selectedPanelState.get();
  }
  static getPieceId(): number | undefined {
    return selectedPanelState.getPieceId();
  }
  static set(panel: Panel | undefined, pieceId?: number): void {
    selectedPanelState.set(panel, pieceId);
  }
}
