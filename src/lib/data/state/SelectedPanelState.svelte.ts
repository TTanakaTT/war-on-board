import type { Panel } from "$lib/domain/entities/Panel";

interface SelectedState {
  panel: Panel | undefined;
  pieceId: number | undefined;
}

const _selectedState = $state<SelectedState>({
  panel: undefined,
  pieceId: undefined,
});

function set(panel: Panel | undefined, pieceId?: number) {
  _selectedState.panel = panel;
  _selectedState.pieceId = pieceId;
}

function get(): Panel | undefined {
  return _selectedState.panel;
}

function getPieceId(): number | undefined {
  return _selectedState.pieceId;
}

export const selectedPanelState = {
  set,
  get,
  getPieceId,
};
