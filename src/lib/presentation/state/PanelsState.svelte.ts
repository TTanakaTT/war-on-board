import { PanelsService } from '$lib/data/services/PanelService';
import { Panel } from '$lib/domain/entities/Panel';

const _panels = $state<Panel[]>([]);

function initialize(layer: number): void {
	if (_panels.length > 0) return;
	_panels.splice(0, _panels.length, ...PanelsService.initialize(layer));
}

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
		}
	}
}

function getAll(): Panel[] {
	return _panels;
}

function setAll(panels: Panel[]): void {
	_panels.splice(0, _panels.length, ...panels);
}

export const panelsState = {
	initialize,
	update,
	remove,
	getAll,
	setAll
};
