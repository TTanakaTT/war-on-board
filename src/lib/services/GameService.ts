import { PanelPosition } from "$lib/domain/entities/PanelPosition";
import { PieceType } from "$lib/domain/enums/PieceType";
import { Player } from "$lib/domain/enums/Player";
import { HomeBase } from "$lib/domain/entities/HomeBase";
import { PanelsService } from "$lib/services/PanelService";
import { PanelRepository } from "$lib/data/repositories/PanelRepository";
import { LayerRepository } from "$lib/data/repositories/LayerRepository";
import { HomeBaseRepository } from "$lib/data/repositories/HomeBaseRepository";
import { InteractionService } from "./InteractionService";
import { GenerationService } from "./GenerationService";
import { TurnAndAiService } from "./TurnAndAiService";
import type { Piece } from "$lib/domain/entities/Piece";

export class GameService {
  static initialize({ layer: layer }: { layer: number }) {
    const panels = PanelsService.initialize(layer);
    PanelRepository.setAll(panels);
    LayerRepository.set(layer);

    HomeBaseRepository.setAll([
      new HomeBase({
        player: Player.SELF,
        panelPosition: new PanelPosition({ horizontalLayer: -(layer - 1), verticalLayer: 0 }),
      }),
      new HomeBase({
        player: Player.OPPONENT,
        panelPosition: new PanelPosition({ horizontalLayer: layer - 1, verticalLayer: 0 }),
      }),
    ]);

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
    GenerationService.generate(pieceType);
  }

  static panelChange(panelPosition: PanelPosition) {
    InteractionService.panelChange(panelPosition);
  }

  static pieceChange(piece: Piece) {
    InteractionService.pieceChange(piece);
  }

  static stateChange(panelPosition: PanelPosition) {
    InteractionService.stateChange(panelPosition);
  }
}
