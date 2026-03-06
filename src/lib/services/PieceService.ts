import { Piece } from "$lib/domain/entities/Piece";
import { PiecesRepository } from "$lib/data/repositories/PieceRepository";
import type { PanelPosition } from "$lib/domain/entities/PanelPosition";
import { Player } from "$lib/domain/enums/Player";
import { Panel } from "$lib/domain/entities/Panel";
import { PanelRepository } from "$lib/data/repositories/PanelRepository";
import { PanelState } from "$lib/domain/enums/PanelState";
import { PieceType } from "$lib/domain/enums/PieceType";
import { CombatService } from "$lib/services/CombatService";
import { PASSIVE_RESOURCE_CAP, PASSIVE_CASTLE_CAP } from "$lib/domain/constants/GameConstants";

export class PieceService {
  static find(panelPosition: PanelPosition): Piece | undefined {
    const pieces = PiecesRepository.getAll();
    return pieces.find((x: Piece) => x.panelPosition.equals(panelPosition));
  }

  static findByPlayer(player: Player): Piece | undefined {
    const pieces = PiecesRepository.getAll();
    return pieces.find((x: Piece) => x.player === player);
  }

  static generateNextId(): number {
    return (
      PiecesRepository.getAll().reduce((max: number, piece: Piece) => Math.max(max, piece.id), 0) +
      1
    );
  }

  static move(panelPosition: PanelPosition, selectedPiece: Piece) {
    const newPiece = new Piece({
      id: selectedPiece.id,
      panelPosition: panelPosition,
      initialPosition: panelPosition,
      targetPosition: undefined,
      player: selectedPiece.player,
      pieceType: selectedPiece.pieceType,
      hp: selectedPiece.hp,
    });
    PiecesRepository.update(newPiece);
  }

  static resetInitialPositions(player: Player) {
    const pieces = PiecesRepository.getPiecesByPlayer(player);
    for (const piece of pieces) {
      const newPiece = new Piece({
        ...piece,
        initialPosition: piece.panelPosition,
      });
      PiecesRepository.update(newPiece);
    }
  }

  /**
   * Execute a move action for a piece toward a target panel.
   *
   * Castle-first rule: if the target panel has castle > 0 and belongs to an
   * enemy, only the wall is attacked — units behind it cannot be attacked
   * and the attacker stays in place.
   */
  static executeMove(attacker: Piece, targetPosition: PanelPosition): void {
    const targetPanel = PanelRepository.find(targetPosition);
    let currentAttacker = attacker;

    // Castle-first rule: wall must be destroyed before attacking units or moving in
    if (
      targetPanel &&
      targetPanel.player !== currentAttacker.player &&
      targetPanel.player !== Player.UNKNOWN &&
      targetPanel.castle > 0
    ) {
      CombatService.attackWall(currentAttacker, targetPanel);
      // Piece stays in current position after siege
      const updatedPiece = new Piece({
        ...currentAttacker,
        targetPosition: undefined,
      });
      PiecesRepository.update(updatedPiece);
      return;
    }

    // No castle — proceed with normal combat
    const existingPieces = PiecesRepository.getPiecesByPosition(targetPosition);
    const existingEnemyPieces = existingPieces.filter((p) => p.player !== attacker.player);

    let attackerDead = false;
    let defenderDead = false;

    if (existingEnemyPieces.length > 0) {
      const combatResult = CombatService.attackPiece(currentAttacker, existingEnemyPieces[0]);
      attackerDead = combatResult.attackerDead;
      defenderDead = combatResult.defenderDead;
      if (!attackerDead) {
        const updatedAttacker = PiecesRepository.getAll().find((p) => p.id === currentAttacker.id);
        if (updatedAttacker) {
          currentAttacker = updatedAttacker;
        }
      }
    }

    if (!attackerDead) {
      const noMoreEnemies = existingEnemyPieces.length === 0 || defenderDead;
      const noMoreWall =
        !targetPanel ||
        targetPanel.player === currentAttacker.player ||
        targetPanel.player === Player.UNKNOWN ||
        targetPanel.castle <= 0;

      if (noMoreEnemies && noMoreWall) {
        this.move(targetPosition, currentAttacker);
        PanelRepository.update(
          new Panel({
            panelPosition: targetPosition,
            panelState: targetPanel?.panelState ?? PanelState.OCCUPIED,
            player: currentAttacker.player,
            resource: targetPanel?.resource ?? 0,
            castle: targetPanel?.castle ?? 0,
          }),
        );
      } else {
        const updatedPiece = new Piece({
          ...currentAttacker,
          targetPosition: undefined,
        });
        PiecesRepository.update(updatedPiece);
      }
    }
  }

  static applyPassiveGains(player: Player) {
    const pieces = PiecesRepository.getPiecesByPlayer(player);
    pieces.forEach((piece: Piece) => {
      const panel = PanelRepository.find(piece.panelPosition);
      if (!panel) return;

      if (piece.pieceType === PieceType.BISHOP) {
        PanelRepository.update(
          new Panel({
            ...panel,
            resource: Math.min(PASSIVE_RESOURCE_CAP, (panel.resource || 0) + 1),
          }),
        );
      } else if (piece.pieceType === PieceType.ROOK) {
        // Increase castle by 1, cap growth at PASSIVE_CASTLE_CAP but never reduce existing values above it (e.g. home base=10)
        const increased = Math.min(PASSIVE_CASTLE_CAP, (panel.castle || 0) + 1);
        PanelRepository.update(
          new Panel({
            ...panel,
            castle: Math.max(panel.castle, increased),
          }),
        );
      } else {
        PanelRepository.update(
          new Panel({
            ...panel,
            player: player,
          }),
        );
      }
    });
  }

  static finalizePlayerMoves(player: Player) {
    const pieces = PiecesRepository.getPiecesByPlayer(player);
    // Important: we need to use a snapshot of the pieces that have targetPosition
    // because executeMove will update the repository.
    const piecesWithMoves = pieces.filter((p) => p.targetPosition);

    for (const piece of piecesWithMoves) {
      if (piece.targetPosition) {
        this.executeMove(piece, piece.targetPosition);
      }
    }
  }
}
