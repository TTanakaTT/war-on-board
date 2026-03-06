import { Player } from "$lib/domain/enums/Player";
import { PieceType } from "$lib/domain/enums/PieceType";
import { Piece } from "$lib/domain/entities/Piece";
import { PanelsService } from "$lib/services/PanelService";
import { PanelRepository } from "$lib/data/repositories/PanelRepository";
import { PiecesRepository } from "$lib/data/repositories/PieceRepository";
import { TurnRepository } from "$lib/data/repositories/TurnRepository";
import { GameRulesService } from "./GameRulesService";
import { PieceService } from "./PieceService";
import { VictoryService } from "./VictoryService";

export class TurnAndAiService {
  private static movedPieceIds: Set<number> = new Set();
  private static onTurnEnd?: () => void;

  static initializeTurn() {
    TurnRepository.set({
      player: Player.SELF,
      num: 1,
      resources: {
        [String(Player.SELF)]: 0,
        [String(Player.OPPONENT)]: 0,
      },
      maxPiecesPerPanel: {
        [String(Player.SELF)]: 2,
        [String(Player.OPPONENT)]: 2,
      },
      generationMode: {
        [String(Player.SELF)]: "rear",
        [String(Player.OPPONENT)]: "rear",
      },
      winner: null,
    });
    this.addResources(Player.SELF);
  }

  static setOnTurnEnd(handler: () => void) {
    this.onTurnEnd = handler;
  }

  static nextTurn() {
    this.movedPieceIds.clear();
    const currentTurn = TurnRepository.get();

    // Do not proceed if game is over
    if (currentTurn.winner) return;

    // 1. Finalize current player's actions
    PieceService.finalizePlayerMoves(currentTurn.player);
    PanelsService.refreshPanelStates();

    // 2. Check victory after moves are resolved
    VictoryService.applyVictory();
    if (TurnRepository.get().winner) return;

    // 3. Determine next player
    const nextPlayer = currentTurn.player === Player.SELF ? Player.OPPONENT : Player.SELF;
    const nextNum = currentTurn.player === Player.OPPONENT ? currentTurn.num + 1 : currentTurn.num;

    // 4. Prepare for next player's turn
    PieceService.resetInitialPositions(nextPlayer);
    PieceService.applyPassiveGains(nextPlayer);

    // 5. Update Turn Repository with new player and turn number
    TurnRepository.set({
      ...TurnRepository.get(),
      player: nextPlayer,
      num: nextNum,
    });

    // 6. Add resources for the start of the NEW turn
    this.addResources(nextPlayer);

    // 7. Handle turn start actions
    if (nextPlayer === Player.OPPONENT) {
      setTimeout(() => {
        this.doOpponentTurn();
      }, 1000);
    }
  }

  static addResources(player: Player) {
    const turn = TurnRepository.get();
    const panels = PanelRepository.getAll().filter((p) => p.player === player);
    const totalResource = panels.reduce((sum, p) => sum + (p.resource || 0), 0);

    const newResources = { ...turn.resources };
    newResources[String(player)] = (newResources[String(player)] || 0) + totalResource;

    TurnRepository.set({ ...turn, resources: newResources });
  }

  static doOpponentTurn() {
    const turn = TurnRepository.get();
    if (turn.player !== Player.OPPONENT || turn.winner) return;

    const opponentPieces = PiecesRepository.getPiecesByPlayer(Player.OPPONENT);
    const opponentResources = turn.resources[String(Player.OPPONENT)] ?? 0;

    // Filter out pieces that have already moved this turn
    const unmovedPieces = opponentPieces.filter((p: Piece) => !this.movedPieceIds.has(p.id));

    // If there are unmoved pieces, move one
    if (unmovedPieces.length > 0) {
      const randomPiece = unmovedPieces[Math.floor(Math.random() * unmovedPieces.length)];
      GameRulesService.pieceChange(randomPiece);

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
      return;
    }

    // After moving pieces, try to produce a piece using the new generation logic
    const generatePosition = GameRulesService.findGenerationPanel(Player.OPPONENT);
    if (generatePosition) {
      const pieceTypes = [PieceType.KNIGHT, PieceType.BISHOP, PieceType.ROOK];
      const affordablePieceTypes = pieceTypes.filter((t) => t.config.cost <= opponentResources);

      if (affordablePieceTypes.length > 0) {
        const randomPieceType =
          affordablePieceTypes[Math.floor(Math.random() * affordablePieceTypes.length)];
        GameRulesService.generate(randomPieceType);
      }
    }

    // End the turn
    setTimeout(() => {
      const panels = PanelsService.clearSelected();
      PanelRepository.setAll(panels);
      this.onTurnEnd?.();
    }, 1000);
  }
}
