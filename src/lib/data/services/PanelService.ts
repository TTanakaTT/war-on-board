import { Panel } from '$lib/domain/entities/Panel';
import { PANELSTATE, type PanelState } from '$lib/domain/enums/PanelStates';
import { PanelPosition } from '$lib/domain/entities/PanelPosition';
import { panelsState } from '$lib/presentation/state/PanelsState.svelte';
import { PiecesRepository } from '../repositories/PieceRepository';

export class PanelsService {
	static initialize(layer: number): Panel[] {
		const panels: Panel[] = [];
		for (let hl = -(layer - 1); hl <= layer - 1; hl++) {
			for (let vl = 0; vl < layer - Math.abs(hl); vl++) {
				panels.push(
					new Panel({
						panelPosition: new PanelPosition({ horizontalLayer: hl, verticalLayer: vl }),
						panelState: PANELSTATE.UNOCCUPIED
					})
				);
			}
		}
		return panels;
	}

	static findPanelState(panelPosition: PanelPosition): PANELSTATE | undefined {
		const panels = panelsState.getAll();
		const panelStates: PanelState[] = panels
			.filter((x) => x.panelPosition.equals(panelPosition))
			.map((y) => y.panelState);
		if (panelStates.length !== 1) {
			console.warn(
				`PanelState for ${panelPosition.horizontalLayer}, ${panelPosition.verticalLayer} is not unique:`,
				panelStates
			);
			return undefined;
		}
		return panelStates[0];
	}

	static findAdjacentPanels(panelPosition: PanelPosition): Panel[] {
		const panels = panelsState.getAll();
		return panels.filter((x) => x.panelPosition.isAdjacent(panelPosition));
	}

	static filterMovablePanels(): Panel[] {
		const panels = panelsState.getAll();
		return panels.filter((p) => p.panelState === PANELSTATE.MOVABLE);
	}

	static clearSelected(): Panel[] {
		const panels = panelsState.getAll();
		return panels.map((p) => {
			switch (p.panelState) {
				case PANELSTATE.MOVABLE:
				case PANELSTATE.IMMOVABLE:
				case PANELSTATE.SELECTED: {
					const hasPiece = PiecesRepository.getPiecesByPosition(p.panelPosition).length > 0;

					return new Panel({
						panelPosition: p.panelPosition,
						panelState: hasPiece ? PANELSTATE.OCCUPIED : PANELSTATE.UNOCCUPIED
					});
				}
				default:
					return p;
			}
		});
	}
}
