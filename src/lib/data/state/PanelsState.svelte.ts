import { Panel } from "#lib/domain/entities/Panel.ts";

const _panels = $state<Panel[]>([]);
/** Counts changes to which panels make up the board (not to the panels' contents). */
let _layoutVersion = 0;

function update(panel: Panel): void {
  const idx = _panels.findIndex((x) => x.panelPosition.equals(panel.panelPosition));
  if (idx >= 0) {
    _panels[idx] = panel;
  }
}

function remove(panel: Panel): void {
  for (let i = _panels.length - 1; i >= 0; i--) {
    if (_panels[i].panelPosition.equals(panel.panelPosition)) {
      _panels.splice(i, 1);
      _layoutVersion += 1;
    }
  }
}

function getAll(): Panel[] {
  return _panels;
}

function setAll(panels: Panel[]): void {
  const sameLayout =
    panels.length === _panels.length &&
    panels.every((panel, i) => panel.panelPosition.equals(_panels[i].panelPosition));
  _panels.splice(0, _panels.length, ...panels);
  if (!sameLayout) _layoutVersion += 1;
}

function getLayoutVersion(): number {
  return _layoutVersion;
}

export const panelsState = {
  update,
  remove,
  getAll,
  setAll,
  getLayoutVersion,
};
