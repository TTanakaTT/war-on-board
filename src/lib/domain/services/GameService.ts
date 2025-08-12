import { panelsState } from '$lib/presentation/state/PanelsState.svelte';
import { piecesState } from '$lib/presentation/state/PiecesState.svelte';
import { Panel } from '$lib/domain/entities/Panel';
import { Piece } from '$lib/domain/entities/Piece';
import { PanelState } from '$lib/domain/enums/PanelState';
import { Player } from '$lib/domain/enums/Player';
import { PanelPosition } from '$lib/domain/entities/PanelPosition';
import { PieceType } from '$lib/domain/enums/PieceType';
import { PanelsService } from '$lib/data/services/PanelService';
import { PiecesRepository } from '$lib/data/repositories/PieceRepository';
import { turnState } from '$lib/presentation/state/TurnState.svelte';
import { layerState } from '$lib/presentation/state/LayerState.svelte';
import { selectedPanelState } from '$lib/presentation/state/SelectedPanelState.svelte';
import { PieceService } from '$lib/data/services/PieceService';
import { timerState } from '$lib/presentation/state/TimerState.svelte';

export class GameService {
	static initialize({ layer: layer }: { layer: number }) {
		panelsState.initialize(layer);
		layerState.set(layer);
		timerState.startTimer();
		turnState.set({ player: Player.SELF, num: 1 });
	}

	static nextTurn() {
		timerState.stopTimer();

		const turn = turnState.get();
		switch (turn.player) {
			case Player.SELF: {
				turnState.set({ ...turn, player: Player.OPPONENT });
				setTimeout(() => {
					timerState.startTimer();
					this.doOpponentTurn();
				}, 1000);
				break;
			}
			case Player.OPPONENT: {
				turnState.set({ ...turn, player: Player.SELF, num: turn.num + 1 });
				setTimeout(() => {
					timerState.startTimer();
				}, 1000);
				break;
			}
			default: {
				throw new Error(`Unknown player: ${turn.player}`);
			}
		}
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
		if (turnState.get().player !== Player.OPPONENT) {
			return;
		}
		const opponentPieces = PiecesRepository.getPiecesByPlayer(Player.OPPONENT);
		if (opponentPieces.length === 0) {
			const pieceTypes = [PieceType.KNIGHT, PieceType.BISHOP, PieceType.ROOK];
			const randomPieceType = pieceTypes[Math.floor(Math.random() * pieceTypes.length)];
			this.generate(randomPieceType);
			setTimeout(() => this.doOpponentTurn(), 1000);
			return;
		}

		const randomPiece = opponentPieces[Math.floor(Math.random() * opponentPieces.length)];
		this.panelChange(randomPiece.panelPosition);

		setTimeout(() => {
			const movablePanels = PanelsService.filterMovablePanels();
			if (movablePanels.length === 0) {
				const pieceTypes = [PieceType.KNIGHT, PieceType.BISHOP, PieceType.ROOK];
				const randomPieceType = pieceTypes[Math.floor(Math.random() * pieceTypes.length)];
				this.panelChange(randomPiece.panelPosition);
				this.generate(randomPieceType);
				setTimeout(() => this.doOpponentTurn(), 1000);
				return;
			}

			const randomPanel = movablePanels[Math.floor(Math.random() * movablePanels.length)];
			this.panelChange(randomPanel.panelPosition);

			setTimeout(() => this.doOpponentTurn(), 1000);
		}, 1000);
	}
	static generate(pieceType: PieceType = PieceType.KNIGHT) {
		const turn = turnState.get();
		const layer = layerState.get();
		const generatePosition = new PanelPosition({
			horizontalLayer: turn.player === Player.SELF ? -(layer - 1) : layer - 1,
			verticalLayer: 0
		});
		if (PiecesRepository.getPiecesByPosition(generatePosition).length > 0) {
			console.warn(
				`Cannot generate piece at ${generatePosition.horizontalLayer}, ${generatePosition.verticalLayer} because it is already occupied.`
			);
			return;
		}
		const piece = new Piece({
			panelPosition: generatePosition,
			player: turn.player,
			pieceType: pieceType
		});
		piecesState.add(piece);
		panelsState.update(
			new Panel({
				panelPosition: generatePosition,
				panelState: PanelState.OCCUPIED,
				player: turn.player,
				resource: 5,
				castle: 5
			})
		);
	}

	static panelChange(panelPosition: PanelPosition) {
		const turn = turnState.get();
		const _selectedPiece = PiecesRepository.getPiecesByPosition(panelPosition)[0];
		const panelState = PanelsService.findPanelState(panelPosition);
		if (
			panelState != PanelState.MOVABLE &&
			_selectedPiece &&
			_selectedPiece.player !== turn.player
		) {
			return;
		}
		switch (panelState) {
			case PanelState.SELECTED: {
				break;
			}
			case PanelState.MOVABLE: {
				const selectedPanel = selectedPanelState.get();
				const selectedPiece = PiecesRepository.getPiecesByPosition(selectedPanel!.panelPosition)[0];
				const existingPieces = PiecesRepository.getPiecesByPosition(panelPosition);
				const existingEnemyPieces = existingPieces.filter((p) => p.player !== selectedPiece.player);
				if (existingEnemyPieces.length > 0) {
					piecesState.remove(selectedPiece);
					existingEnemyPieces.forEach((p) => piecesState.remove(p));
					panelsState.update(
						new Panel({
							panelPosition: panelPosition,
							panelState: PanelState.OCCUPIED,
							player: selectedPiece.player,
							resource: selectedPanel!.resource,
							castle: selectedPanel!.castle
						})
					);
				} else {
					PieceService.move(panelPosition, selectedPiece);
				}
				break;
			}
			default: {
				selectedPanelState.set(
					new Panel({
						panelPosition: panelPosition,
						panelState: panelState ? panelState : PanelState.SELECTED,
						player: turn.player,
						resource: 0,
						castle: 0
					})
				);
			}
		}
		this.stateChange(panelPosition);
	}

	static stateChange(panelPosition: PanelPosition) {
		const originalPanel = PanelsService.find(panelPosition);
		const panelState = originalPanel?.panelState;
		let panel: Panel;

		switch (panelState) {
			case PanelState.SELECTED:
			case PanelState.MOVABLE: {
				const cleared = PanelsService.clearSelected();
				panelsState.setAll(cleared);
				break;
			}
			case PanelState.OCCUPIED:
			default: {
				panel = new Panel({
					panelPosition: panelPosition,
					panelState: PanelState.SELECTED,
					player: originalPanel?.player,
					resource: originalPanel?.resource,
					castle: originalPanel?.castle
				});
				panelsState.update(panel);

				const adjacentPanels = PanelsService.findAdjacentPanels(panelPosition);
				adjacentPanels
					.filter((p) => p.panelState === PanelState.UNOCCUPIED)
					.forEach((adjacentPanel) => {
						const hasPiece =
							PiecesRepository.getPiecesByPosition(adjacentPanel.panelPosition).length > 0;
						panelsState.update(
							new Panel({
								panelPosition: adjacentPanel.panelPosition,
								panelState: hasPiece ? PanelState.OCCUPIED : PanelState.MOVABLE,
								player: adjacentPanel.player,
								resource: adjacentPanel.resource,
								castle: adjacentPanel.castle
							})
						);
					});
				// 隣接パネル以外をIMMOVABLEにする
				const allPanels = panelsState.getAll();
				const adjacentPositions = adjacentPanels.map((p) => p.panelPosition);
				allPanels.forEach((p) => {
					if (
						!p.panelPosition.equals(panelPosition) &&
						!adjacentPositions.includes(p.panelPosition) &&
						p.panelState !== PanelState.IMMOVABLE
					) {
						panelsState.update(
							new Panel({
								panelPosition: p.panelPosition,
								panelState: PanelState.IMMOVABLE,
								player: p.player,
								resource: p.resource,
								castle: p.castle
							})
						);
					}
				});
				break;
			}
		}
	}
}
