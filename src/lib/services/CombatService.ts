import { Piece } from "$lib/domain/entities/Piece";
import { Panel } from "$lib/domain/entities/Panel";
import { PiecesRepository } from "$lib/data/repositories/PieceRepository";
import { PanelRepository } from "$lib/data/repositories/PanelRepository";

/**
 * CombatService — handles all combat resolution (piece-vs-piece, piece-vs-wall).
 *
 * Pure side-effect service: reads/writes Piece and Panel repositories.
 * No UI state manipulation.
 */
export class CombatService {
  /**
   * Resolve simultaneous combat between two pieces.
   * Both deal damage at the same time; pieces with HP <= 0 are removed.
   */
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

  /**
   * Attack a panel's castle wall.
   * Reduces castle value by attacker's wall-attack power (minimum 0).
   */
  static attackWall(attacker: Piece, panel: Panel): { wallDestroyed: boolean } {
    const damage = attacker.pieceType.config.attackPowerAgainstWall;
    const newCastleValue = Math.max(0, panel.castle - damage);

    const wallDestroyed = newCastleValue <= 0;

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
