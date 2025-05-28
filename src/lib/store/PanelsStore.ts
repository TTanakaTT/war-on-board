import { writable, derived, type Readable } from 'svelte/store';
import type { Panel } from '$lib/interfaces/Panel';
import { PANELSTATE, type PanelState } from '$lib/enums/PanelStates';

export const panels = writable<Panel[]>([]);

function getPanelStates(horizontalLayer: number, verticalLayer: number): Readable<PANELSTATE[]> {
	return derived(panels, ($panels) => {
		if (!$panels?.length) {
			return [];
		}
		const panelStates: PanelState[] = $panels
			.filter((x) => x.horizontalLayer === horizontalLayer && x.verticalLayer === verticalLayer)
			.map((y) => y.panelState);
		const isMoveCandidated =
			$panels.filter(
				(x) =>
					!(x.horizontalLayer === horizontalLayer && x.verticalLayer === verticalLayer) &&
					x.horizontalLayer - horizontalLayer >= -1 &&
					x.horizontalLayer - horizontalLayer <= 1 &&
					x.verticalLayer - verticalLayer >= -1 &&
					x.verticalLayer - verticalLayer <= 1 &&
					Math.abs(x.horizontalLayer) -
						Math.abs(horizontalLayer) +
						x.verticalLayer -
						verticalLayer >=
						-1 &&
					Math.abs(x.horizontalLayer) -
						Math.abs(horizontalLayer) +
						x.verticalLayer -
						verticalLayer <=
						1 &&
					x.panelState === PANELSTATE.SELECTED
			).length > 0;
		const isNotSelected =
			$panels.filter(
				(x) =>
					!(x.horizontalLayer === horizontalLayer && x.verticalLayer === verticalLayer) &&
					x.panelState === PANELSTATE.SELECTED
			).length > 0;
		if (isMoveCandidated) {
			panelStates.push(PANELSTATE.MOVABLE);
		} else if (isNotSelected) {
			panelStates.push(PANELSTATE.IMMOVABLE);
		}
		panelStates.sort();
		return panelStates;
	});
}
function update(panel: Panel): void {
	panels.update((panels) => {
		const thisPanelIndex = panels.findIndex(
			(x) => x.horizontalLayer === panel.horizontalLayer && x.verticalLayer === panel.verticalLayer
		);
		const isPanelExisted = thisPanelIndex >= 0;
		const isNormal = panel.panelState === PANELSTATE.UNOCCUPIED;
		if (isPanelExisted && isNormal) {
			return panels.filter((x, index) => index !== thisPanelIndex);
		} else if (!isPanelExisted && !isNormal) {
			return panels.concat(panel);
		} else if (isPanelExisted && !isNormal) {
			panels[thisPanelIndex].panelState = panel.panelState;
		}
		return panels;
	});
}
function remove(panel: Panel): void {
	panels.update((panels) => {
		return panels.filter(
			(x) =>
				x.horizontalLayer !== panel.horizontalLayer ||
				x.verticalLayer !== panel.verticalLayer ||
				x.panelState !== panel.panelState
		);
	});
}

export const panelsStore = {
	getPanelStates: getPanelStates,
	update: update,
	remove: remove
};
