import { Panel } from "$lib/domain/entities/Panel";
import { PanelPosition } from "$lib/domain/entities/PanelPosition";
import { PieceType } from "$lib/domain/enums/PieceType";
import { PanelsService } from "$lib/services/PanelService";
import { PanelRepository } from "$lib/data/repositories/PanelRepository";
import { PiecesRepository } from "$lib/data/repositories/PieceRepository";
import { TurnRepository } from "$lib/data/repositories/TurnRepository";
import { LayerRepository } from "$lib/data/repositories/LayerRepository";
import { GameRulesService } from "./GameRulesService";
import { TurnAndAiService } from "./TurnAndAiService";
import { Piece } from "$lib/domain/entities/Piece";

export class GameService {
  static initialize({ layer: layer }: { layer: number }) {
    const panels = PanelsService.initialize(layer);
    PanelRepository.setAll(panels);
    LayerRepository.set(layer);
    TurnAndAiService.setOnTurnEnd(() => GameService.nextTurn());
    TurnAndAiService.initializeTurn();
  }

  static nextTurn() {
    TurnAndAiService.nextTurn();
    const turn = TurnRepository.get();

    // Reset initial positions for all pieces at turn start (preserve ids)
    const allPieces = PiecesRepository.getPiecesByPlayer(turn.player);
    allPieces.forEach((piece: Piece) => {
      const newPiece = new Piece({
        id: piece.id,
        panelPosition: piece.panelPosition,
        initialPosition: piece.panelPosition,
        player: piece.player,
        pieceType: piece.pieceType,
      });
      PiecesRepository.update(newPiece);
    });

    const playerPieces = PiecesRepository.getPiecesByPlayer(turn.player);
    playerPieces.forEach((piece: Piece) => {
      const panelPosition = piece.panelPosition;
      const panel = PanelsService.find(panelPosition);

      if (panel) {
        switch (piece.pieceType) {
          case PieceType.BISHOP:
            PanelRepository.update(
              new Panel({
                panelPosition: panelPosition,
                panelState: panel.panelState,
                player: turn.player,
                resource: Math.min(5, (panel.resource || 0) + 1),
                castle: panel.castle,
              }),
            );
            break;
          case PieceType.ROOK:
            PanelRepository.update(
              new Panel({
                panelPosition: panelPosition,
                panelState: panel.panelState,
                player: turn.player,
                resource: panel.resource,
                castle: Math.min(5, (panel.castle || 0) + 1),
              }),
            );
            break;
          default:
            PanelRepository.update(
              new Panel({
                panelPosition: panelPosition,
                panelState: panel.panelState,
                player: turn.player,
                resource: panel.resource,
                castle: panel.castle,
              }),
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
