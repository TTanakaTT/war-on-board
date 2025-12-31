import { Player } from "$lib/domain/enums/Player";
import { PieceType } from "$lib/domain/enums/PieceType";
import { PanelsService } from "$lib/data/services/PanelService";
import { PanelRepository } from "$lib/data/repositories/PanelRepository";
import { PiecesRepository } from "$lib/data/repositories/PieceRepository";
import { TurnRepository } from "$lib/data/repositories/TurnRepository";
import { GameRulesService } from "./GameRulesService";

export class TurnAndAiService {
  private static movedPieceIds: Set<number> = new Set();
  private static onTurnEnd?: () => void;

  static initializeTurn() {
    TurnRepository.set({ player: Player.SELF, num: 1 });
  }

  static setOnTurnEnd(handler: () => void) {
    this.onTurnEnd = handler;
  }

  static nextTurn() {
    this.movedPieceIds.clear();
    const turn = TurnRepository.get();
    switch (turn.player) {
      case Player.SELF: {
        TurnRepository.set({ ...turn, player: Player.OPPONENT });
        setTimeout(() => {
          this.doOpponentTurn();
        }, 1000);
        break;
      }
      case Player.OPPONENT: {
        TurnRepository.set({ ...turn, player: Player.SELF, num: turn.num + 1 });
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

    // Filter out pieces that have already moved this turn
    const unmovedPieces = opponentPieces.filter((p) => !this.movedPieceIds.has(p.id));

    // If all pieces have moved, end the turn
    if (unmovedPieces.length === 0) {
      setTimeout(() => {
        const panels = PanelsService.clearSelected();
        PanelRepository.setAll(panels);
        this.onTurnEnd?.();
      }, 1000);
      return;
    }

    const randomPiece = unmovedPieces[Math.floor(Math.random() * unmovedPieces.length)];
    GameRulesService.panelChange(randomPiece.panelPosition);

    setTimeout(() => {
      const movablePanels = PanelsService.filterMovablePanels();
      if (movablePanels.length === 0) {
        // No movable panels, so this piece stays in place (mark as moved)
        this.movedPieceIds.add(randomPiece.id);
        GameRulesService.panelChange(randomPiece.panelPosition);
        setTimeout(() => this.doOpponentTurn(), 1000);
        return;
      }

      const randomPanel = movablePanels[Math.floor(Math.random() * movablePanels.length)];
      GameRulesService.panelChange(randomPanel.panelPosition);
      this.movedPieceIds.add(randomPiece.id);

      setTimeout(() => this.doOpponentTurn(), 1000);
    }, 1000);
  }
}
