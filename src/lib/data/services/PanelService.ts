import { Panel } from '$lib/domain/entities/Panel';
import { PanelState } from '$lib/domain/enums/PanelState';
import { PanelPosition } from '$lib/domain/entities/PanelPosition';
import { PanelRepository } from '$lib/data/repositories/PanelRepository';
import { PiecesRepository } from '../repositories/PieceRepository';
import { Player } from '$lib/domain/enums/Player';

export class PanelsService {
	static initialize(layer: number): Panel[] {
		const panels: Panel[] = [];
		for (let hl = -(layer - 1); hl <= layer - 1; hl++) {
			for (let vl = 0; vl < layer - Math.abs(hl); vl++) {
				let initPlayer = Player.UNKNOWN;
				if (hl === -(layer - 1) && vl === 0) {
					initPlayer = Player.SELF;
				} else if (hl === layer - 1 && vl === 0) {
					initPlayer = Player.OPPONENT;
				}
				const initResource = Math.abs(hl) === layer - 1 && vl === 0 ? 5 : 0;
				panels.push(
					new Panel({
						panelPosition: new PanelPosition({ horizontalLayer: hl, verticalLayer: vl }),
						panelState: PanelState.UNOCCUPIED,
						player: initPlayer,
						resource: initResource,
						castle: initResource
					})
				);
			}
		}
		return panels;
	}

	static find(panelPosition: PanelPosition): Panel | undefined {
		const panels = PanelRepository.getAll();
		return panels.find((x) => x.panelPosition.equals(panelPosition));
	}

	static findPanelState(panelPosition: PanelPosition): PanelState | undefined {
		const panelState = this.find(panelPosition)?.panelState;
		return panelState;
	}

	static findAdjacentPanels(panelPosition: PanelPosition): Panel[] {
		const panels = PanelRepository.getAll();
		return panels.filter((x) => x.panelPosition.isAdjacent(panelPosition));
	}

	static filterMovablePanels(): Panel[] {
		const panels = PanelRepository.getAll();
		return panels.filter((p) => p.panelState === PanelState.MOVABLE);
	}

	static clearSelected(): Panel[] {
		const panels = PanelRepository.getAll();
		return panels.map((p) => {
			switch (p.panelState) {
				case PanelState.MOVABLE:
				case PanelState.IMMOVABLE:
				case PanelState.SELECTED: {
					const hasPiece = PiecesRepository.getPiecesByPosition(p.panelPosition).length > 0;

					return new Panel({
						panelPosition: p.panelPosition,
						panelState: hasPiece ? PanelState.OCCUPIED : PanelState.UNOCCUPIED,
						player: p.player,
						resource: p.resource,
						castle: p.castle
					});
				}
				default:
					return p;
			}
		});
	}
}
