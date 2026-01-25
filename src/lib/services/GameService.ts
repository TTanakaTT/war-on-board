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
