import { Piece } from "$lib/domain/entities/Piece";
import { PiecesRepository } from "$lib/data/repositories/PieceRepository";
import type { PanelPosition } from "$lib/domain/entities/PanelPosition";
import { Player } from "$lib/domain/enums/Player";
import { Panel } from "$lib/domain/entities/Panel";
import { PanelRepository } from "$lib/data/repositories/PanelRepository";
import { PanelState } from "$lib/domain/enums/PanelState";

import { PieceType } from "$lib/domain/enums/PieceType";

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

  static executeMove(attacker: Piece, targetPosition: PanelPosition): void {
    const targetPanel = PanelRepository.find(targetPosition);
    const existingPieces = PiecesRepository.getPiecesByPosition(targetPosition);
    const existingEnemyPieces = existingPieces.filter((p) => p.player !== attacker.player);

    let attackerDead = false;
    let defenderDead = false;
    let currentAttacker = attacker;
    let currentTargetPanel = targetPanel;

    if (existingEnemyPieces.length > 0) {
      const combatResult = this.attackPiece(currentAttacker, existingEnemyPieces[0]);
      attackerDead = combatResult.attackerDead;
      defenderDead = combatResult.defenderDead;
      if (!attackerDead) {
        // Refetch attacker as its HP might have changed
        const updatedAttacker = PiecesRepository.getAll().find((p) => p.id === currentAttacker.id);
        if (updatedAttacker) {
          currentAttacker = updatedAttacker;
        }
      }
    }

    // Only attack wall if no enemy pieces are left and attacker is still alive
    if (
      !attackerDead &&
      (existingEnemyPieces.length === 0 || defenderDead) &&
      currentTargetPanel &&
      currentTargetPanel.player !== currentAttacker.player &&
      currentTargetPanel.castle > 0
    ) {
      this.attackWall(currentAttacker, currentTargetPanel);
      // Fetch updated panel (with new castle value)
      currentTargetPanel = PanelRepository.find(targetPosition) || targetPanel;
    }

    if (!attackerDead) {
      const noMoreEnemies = existingEnemyPieces.length === 0 || defenderDead;
      const noMoreWall =
        !currentTargetPanel ||
        currentTargetPanel.player === currentAttacker.player ||
        currentTargetPanel.player === Player.UNKNOWN ||
        currentTargetPanel.castle <= 0;

      if (noMoreEnemies && noMoreWall) {
        this.move(targetPosition, currentAttacker);
        PanelRepository.update(
          new Panel({
            panelPosition: targetPosition,
            panelState: targetPanel?.panelState ?? PanelState.OCCUPIED,
            player: currentAttacker.player,
            resource: currentTargetPanel?.resource ?? 0,
            castle: currentTargetPanel?.castle ?? 0,
          }),
        );
      } else {
        // Did not move, but maybe HP changed, so update it and clear target
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
            resource: Math.min(5, (panel.resource || 0) + 1),
          }),
        );
      } else if (piece.pieceType === PieceType.ROOK) {
        PanelRepository.update(
          new Panel({
            ...panel,
            castle: Math.min(5, (panel.castle || 0) + 1),
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

  static attackPiece(
    attacker: Piece,
    defender: Piece,
  ): { attackerDead: boolean; defenderDead: boolean } {
    const damageToDefender = attacker.pieceType.config.attackPowerAgainstPiece;
    const damageToAttacker = defender.pieceType.config.attackPowerAgainstPiece;

    const newDefenderHp = defender.hp - damageToDefender;
    const newAttackerHp = attacker.hp - damageToAttacker;

    let attackerDead = false;
    let defenderDead = false;

    if (newDefenderHp <= 0) {
      PiecesRepository.remove(defender);
      defenderDead = true;
    } else {
      const newDefender = new Piece({
        id: defender.id,
        panelPosition: defender.panelPosition,
        initialPosition: defender.initialPosition,
        player: defender.player,
        pieceType: defender.pieceType,
        hp: newDefenderHp,
      });
      PiecesRepository.update(newDefender);
    }

    if (newAttackerHp <= 0) {
      PiecesRepository.remove(attacker);
      attackerDead = true;
    } else {
      const newAttacker = new Piece({
        id: attacker.id,
        panelPosition: attacker.panelPosition,
        initialPosition: attacker.initialPosition,
        player: attacker.player,
        pieceType: attacker.pieceType,
        hp: newAttackerHp,
      });
      PiecesRepository.update(newAttacker);
    }

    return { attackerDead, defenderDead };
  }

  static attackWall(attacker: Piece, panel: Panel): { wallDestroyed: boolean } {
    const damage = attacker.pieceType.config.attackPowerAgainstWall;
    const newCastleValue = Math.max(0, panel.castle - damage);

    let wallDestroyed = false;
    if (newCastleValue <= 0) {
      wallDestroyed = true;
    }

    const newPanel = new Panel({
      panelPosition: panel.panelPosition,
      panelState: panel.panelState,
      player: panel.player,
      resource: panel.resource,
      castle: newCastleValue,
    });

    PanelRepository.update(newPanel);
    return { wallDestroyed };
  }
}
