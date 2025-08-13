import { panelsState } from '$lib/presentation/state/PanelsState.svelte';
import { Panel } from '$lib/domain/entities/Panel';
import { PanelPosition } from '$lib/domain/entities/PanelPosition';
import { PieceType } from '$lib/domain/enums/PieceType';
import { PanelsService } from '$lib/data/services/PanelService';
import { PiecesRepository } from '$lib/data/repositories/PieceRepository';
import { TurnRepository } from '$lib/data/repositories/TurnRepository';
import { LayerRepository } from '$lib/data/repositories/LayerRepository';
// removed: SelectedPanelRepository, PieceService, TimerRepository after delegation
import { GameRulesService } from './GameRulesService';
import { TurnAndAiService } from './TurnAndAiService';

export class GameService {
	static initialize({ layer: layer }: { layer: number }) {
		panelsState.initialize(layer);
		LayerRepository.set(layer);
		TurnAndAiService.initializeTurn();
	}

	static nextTurn() {
		TurnAndAiService.nextTurn();
		const turn = TurnRepository.get();
		const playerPieces = PiecesRepository.getPiecesByPlayer(turn.player);
		playerPieces.forEach((piece) => {
			const panelPosition = piece.panelPosition;
			const panel = PanelsService.find(panelPosition);

			if (panel) {
				switch (piece.pieceType) {
					case PieceType.BISHOP:
						panelsState.update(
							new Panel({
								panelPosition: panelPosition,
								panelState: panel.panelState,
								player: turn.player,
								resource: Math.min(5, (panel.resource || 0) + 1),
								castle: panel.castle
							})
						);
						break;
					case PieceType.ROOK:
						panelsState.update(
							new Panel({
								panelPosition: panelPosition,
								panelState: panel.panelState,
								player: turn.player,
								resource: panel.resource,
								castle: Math.min(5, (panel.castle || 0) + 1)
							})
						);
						break;
					default:
						panelsState.update(
							new Panel({
								panelPosition: panelPosition,
								panelState: panel.panelState,
								player: turn.player,
								resource: panel.resource,
								castle: panel.castle
							})
						);
						break;
				}
			}
		});
	}

	static doOpponentTurn() {
		TurnAndAiService.doOpponentTurn();
	}
	static generate(pieceType: PieceType = PieceType.KNIGHT) {
		GameRulesService.generate(pieceType);
	}

	static panelChange(panelPosition: PanelPosition) {
		GameRulesService.panelChange(panelPosition);
	}

	static stateChange(panelPosition: PanelPosition) {
		GameRulesService.stateChange(panelPosition);
	}
}
