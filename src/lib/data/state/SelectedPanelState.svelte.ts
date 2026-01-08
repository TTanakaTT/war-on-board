import type { Panel } from "$lib/domain/entities/Panel";

let _selectedPanel = $state<Panel | undefined>(undefined);

function set(panel: Panel | undefined) {
  _selectedPanel = panel;
}

function get(): Panel | undefined {
  return _selectedPanel;
}

export const selectedPanelState = {
  set,
  get,
};
