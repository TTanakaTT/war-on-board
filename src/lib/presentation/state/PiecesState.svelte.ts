import type { PanelPosition } from '$lib/domain/entities/PanelPosition';
import type { Piece } from '$lib/domain/entities/Piece';
import type { Player } from '$lib/domain/enums/Player';

const _pieces = $state<Piece[]>([]);

function add(piece: Piece): void {
	_pieces.push(piece);
}

function remove(piece: Piece): void {
	for (let i = _pieces.length - 1; i >= 0; i--) {
		if (_pieces[i].id === piece.id) {
			_pieces.splice(i, 1);
		}
	}
}

function getAll(): Piece[] {
	return _pieces;
}
function getByPosition(panelPosition: PanelPosition): Piece[] {
	return _pieces.filter((x) => x.panelPosition.equals(panelPosition));
}
function getPiecesByPlayer(player: Player): Piece[] {
	return _pieces.filter((x) => x.player === player);
}

function setAll(newPieces: Piece[]): void {
	_pieces.splice(0, _pieces.length, ...newPieces);
}

// PiecesStateはピースのCRUD操作のみ責任を持つ
export const piecesState = {
	add,
	remove,
	getAll,
	getByPosition,
	getPiecesByPlayer,
	setAll
};
