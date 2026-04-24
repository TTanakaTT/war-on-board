import { Piece } from "$lib/domain/entities/Piece";
import { Panel } from "$lib/domain/entities/Panel";
import { PieceType } from "$lib/domain/enums/PieceType";
import { PiecesRepository } from "$lib/data/repositories/PieceRepository";
import { PanelRepository } from "$lib/data/repositories/PanelRepository";

/**
 * CombatService — handles all combat resolution (piece-vs-piece, piece-vs-wall).
 *
 * Supports multi-unit simultaneous combat:
 *   - Front-line priority: Rook > Knight > Bishop (low ID tiebreak)
 *   - All attackers deal damage to the front-line defender (summed)
 *   - All defenders deal damage to the front-line attacker (summed)
 *   - Damage applied simultaneously; overkill does NOT carry over
 */
export class CombatService {
  /**
   * Front-line priority for target selection.
   * Lower value = higher priority (selected as target first).
   */
  private static frontLinePriority(type: PieceType): number {
    if (type === PieceType.ROOK) return 0;
    if (type === PieceType.KNIGHT) return 1;
    return 2; // Bishop
  }

  /**
   * Select the front-line unit from a group of pieces.
   * Priority: Rook > Knight > Bishop; same type → lowest ID.
   */
  static selectFrontLine(pieces: Piece[]): Piece {
    return [...pieces].sort((a, b) => {
      const pa = this.frontLinePriority(a.pieceType);
      const pb = this.frontLinePriority(b.pieceType);
      if (pa !== pb) return pa - pb;
      return a.id - b.id;
    })[0];
  }

  /**
   * Resolve simultaneous multi-unit combat.
   *
   * Algorithm:
   *   1. Select front-line defender (target for all attackers)
   *   2. Select front-line attacker (target for all defenders' counter-attack)
   *   3. Sum attacker AP → apply to front-line defender
   *   4. Sum defender AP → apply to front-line attacker
   *   5. Apply damage simultaneously; remove dead pieces
   *
   * @returns Set of piece IDs that died in this combat round
   */
  static resolveCombat(attackers: Piece[], defenders: Piece[]): { deadIds: Set<number> } {
    const deadIds = new Set<number>();
    if (attackers.length === 0 || defenders.length === 0) return { deadIds };

    const frontDefender = this.selectFrontLine(defenders);
    const frontAttacker = this.selectFrontLine(attackers);

    // Accumulate damage
    const totalDamageToDefender = attackers.reduce((sum, a) => sum + a.attackPowerAgainstPiece, 0);
    const totalDamageToAttacker = defenders.reduce((sum, d) => sum + d.attackPowerAgainstPiece, 0);

    const newDefenderHp = frontDefender.hp - totalDamageToDefender;
    const newAttackerHp = frontAttacker.hp - totalDamageToAttacker;

    // Apply defender outcome
    if (newDefenderHp <= 0) {
      PiecesRepository.remove(frontDefender);
      deadIds.add(frontDefender.id);
    } else {
      PiecesRepository.update(
        new Piece({
          ...frontDefender,
          hp: newDefenderHp,
        }),
      );
    }

    // Apply attacker outcome
    if (newAttackerHp <= 0) {
      PiecesRepository.remove(frontAttacker);
      deadIds.add(frontAttacker.id);
    } else {
      PiecesRepository.update(
        new Piece({
          ...frontAttacker,
          hp: newAttackerHp,
        }),
      );
    }

    return { deadIds };
  }

  /**
   * Distribute damage across all defenders in proportion to their current HP.
   * Damage is applied simultaneously and may leave fractional HP values.
   */
  static distributeDamage(defenders: Piece[], totalDamage: number): { deadIds: Set<number> } {
    const deadIds = new Set<number>();
    if (defenders.length === 0 || totalDamage <= 0) return { deadIds };

    const totalHp = defenders.reduce((sum, defender) => sum + defender.hp, 0);
    if (totalHp <= 0) return { deadIds };

    for (const defender of defenders) {
      const damageShare = totalDamage * (defender.hp / totalHp);
      const newHp = defender.hp - damageShare;

      if (newHp <= 0) {
        PiecesRepository.remove(defender);
        deadIds.add(defender.id);
        continue;
      }

      PiecesRepository.update(
        new Piece({
          ...defender,
          hp: newHp,
        }),
      );
    }

    return { deadIds };
  }

  /**
   * Multiple attackers simultaneously attack a panel's castle wall.
   * Total damage = sum of all attackers' wall-attack power.
   */
  static attackWallMulti(
    attackers: Piece[],
    panel: Panel,
  ): {
    wallDestroyed: boolean;
    wallDamageDealt: number;
    overflowRatio: number;
    overflowPieceDamage: number;
  } {
    const totalWallDamage = attackers.reduce((sum, a) => sum + a.attackPowerAgainstWall, 0);
    const totalPieceDamage = attackers.reduce((sum, a) => sum + a.attackPowerAgainstPiece, 0);
    const wallDamageDealt = Math.min(panel.castle, totalWallDamage);
    const overflowWallDamage = Math.max(0, totalWallDamage - panel.castle);
    const overflowRatio = totalWallDamage === 0 ? 0 : overflowWallDamage / totalWallDamage;
    const overflowPieceDamage = totalPieceDamage * overflowRatio;
    const newCastleValue = Math.max(0, panel.castle - totalWallDamage);

    PanelRepository.update(
      new Panel({
        panelPosition: panel.panelPosition,
        panelState: panel.panelState,
        player: panel.player,
        resource: panel.resource,
        castle: newCastleValue,
      }),
    );

    return {
      wallDestroyed: newCastleValue <= 0,
      wallDamageDealt,
      overflowRatio,
      overflowPieceDamage,
    };
  }

  /**
   * Single attacker attacks a panel's castle wall.
   * Kept for backward compatibility with single-piece scenarios.
   */
  static attackWall(
    attacker: Piece,
    panel: Panel,
  ): {
    wallDestroyed: boolean;
    wallDamageDealt: number;
    overflowRatio: number;
    overflowPieceDamage: number;
  } {
    return this.attackWallMulti([attacker], panel);
  }
}
