import { Player } from '$lib/domain/enums/Player';
import { PieceType } from '$lib/domain/enums/PieceType';
import { PanelsService } from '$lib/data/services/PanelService';
import { PiecesRepository } from '$lib/data/repositories/PieceRepository';
import { TurnRepository } from '$lib/data/repositories/TurnRepository';
import { TimerRepository } from '$lib/data/repositories/TimerRepository';
import { GameRulesService } from './GameRulesService';

export class TurnAndAiService {
	static initializeTurn() {
		TimerRepository.start();
		TurnRepository.set({ player: Player.SELF, num: 1 });
	}

	static nextTurn() {
		TimerRepository.stop();
		const turn = TurnRepository.get();
		switch (turn.player) {
			case Player.SELF: {
				TurnRepository.set({ ...turn, player: Player.OPPONENT });
				setTimeout(() => {
					TimerRepository.start();
					this.doOpponentTurn();
				}, 1000);
				break;
			}
			case Player.OPPONENT: {
				TurnRepository.set({ ...turn, player: Player.SELF, num: turn.num + 1 });
				setTimeout(() => {
					TimerRepository.start();
				}, 1000);
				break;
			}
			default:
				throw new Error(`Unknown player: ${turn.player}`);
		}
	}

	static doOpponentTurn() {
		if (TurnRepository.get().player !== Player.OPPONENT) return;

		const opponentPieces = PiecesRepository.getPiecesByPlayer(Player.OPPONENT);
		if (opponentPieces.length === 0) {
			const pieceTypes = [PieceType.KNIGHT, PieceType.BISHOP, PieceType.ROOK];
			const randomPieceType = pieceTypes[Math.floor(Math.random() * pieceTypes.length)];
			GameRulesService.generate(randomPieceType);
			setTimeout(() => this.doOpponentTurn(), 1000);
			return;
		}

		const randomPiece = opponentPieces[Math.floor(Math.random() * opponentPieces.length)];
		GameRulesService.panelChange(randomPiece.panelPosition);

		setTimeout(() => {
			const movablePanels = PanelsService.filterMovablePanels();
			if (movablePanels.length === 0) {
				const pieceTypes = [PieceType.KNIGHT, PieceType.BISHOP, PieceType.ROOK];
				const randomPieceType = pieceTypes[Math.floor(Math.random() * pieceTypes.length)];
				GameRulesService.panelChange(randomPiece.panelPosition);
				GameRulesService.generate(randomPieceType);
				setTimeout(() => this.doOpponentTurn(), 1000);
				return;
			}

			const randomPanel = movablePanels[Math.floor(Math.random() * movablePanels.length)];
			GameRulesService.panelChange(randomPanel.panelPosition);

			setTimeout(() => this.doOpponentTurn(), 1000);
		}, 1000);
	}
}
