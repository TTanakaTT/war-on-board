import { Piece } from '../../domain/entities/Piece';
import { piecesState } from '$lib/presentation/state/PiecesState.svelte';
import type { PanelPosition } from '../../domain/entities/PanelPosition';

export class PieceService {
	static generateNextId(): number {
		return piecesState.getAll().reduce((max, piece) => Math.max(max, piece.id), 0) + 1;
	}
	static move(panelPosition: PanelPosition, selectedPiece: Piece) {
		const piece: Piece = new Piece({
			panelPosition: panelPosition,
			player: selectedPiece.player,
			pieceType: selectedPiece.pieceType
		});
		piecesState.remove(selectedPiece);
		piecesState.add(piece);
	}
}
