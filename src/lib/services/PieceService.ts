import { Piece } from "$lib/domain/entities/Piece";
import { PiecesRepository } from "$lib/data/repositories/PieceRepository";
import type { PanelPosition } from "$lib/domain/entities/PanelPosition";
import type { Player } from "$lib/domain/enums/Player";
import { Panel } from "$lib/domain/entities/Panel";
import { PanelRepository } from "$lib/data/repositories/PanelRepository";

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
      initialPosition: selectedPiece.initialPosition,
      player: selectedPiece.player,
      pieceType: selectedPiece.pieceType,
      hp: selectedPiece.hp,
    });
    PiecesRepository.update(newPiece);
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
