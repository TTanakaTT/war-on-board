import { Piece } from "$lib/domain/entities/Piece";
import { Panel } from "$lib/domain/entities/Panel";
import { PiecesRepository } from "$lib/data/repositories/PieceRepository";
import { PanelRepository } from "$lib/data/repositories/PanelRepository";

/**
 * CombatService — handles all combat resolution (piece-vs-piece, piece-vs-wall).
 *
 * Supports multi-unit simultaneous combat:
 *   - Total incoming damage is split across the opposing group by current HP ratio
 *   - Attack and counterattack are applied simultaneously
 *   - Fractional HP is allowed after proportional damage
 */
export class CombatService {
  /**
   * Calculate simultaneous proportional damage outcomes without mutating repositories.
   */
  private static calculateDamageOutcomes(
    recipients: Piece[],
    totalDamage: number,
  ): Array<{ piece: Piece; newHp: number }> {
    if (recipients.length === 0 || totalDamage <= 0) return [];

    const totalHp = recipients.reduce((sum, recipient) => sum + recipient.hp, 0);
    if (totalHp <= 0) return [];

    return recipients.map((recipient) => ({
      piece: recipient,
      newHp: recipient.hp - totalDamage * (recipient.hp / totalHp),
    }));
  }

  /**
   * Apply precomputed damage outcomes to repositories.
   */
  private static applyDamageOutcomes(outcomes: Array<{ piece: Piece; newHp: number }>): {
    deadIds: Set<number>;
  } {
    const deadIds = new Set<number>();

    for (const outcome of outcomes) {
      if (outcome.newHp <= 0) {
        PiecesRepository.remove(outcome.piece);
        deadIds.add(outcome.piece.id);
        continue;
      }

      PiecesRepository.update(
        new Piece({
          ...outcome.piece,
          hp: outcome.newHp,
        }),
      );
    }

    return { deadIds };
  }

  /**
   * Resolve simultaneous proportional damage exchange between two groups.
   */
  private static resolveDistributedExchange(
    attackers: Piece[],
    damageToAttackers: number,
    defenders: Piece[],
    damageToDefenders: number,
  ): { deadIds: Set<number> } {
    const outcomes = [
      ...this.calculateDamageOutcomes(attackers, damageToAttackers),
      ...this.calculateDamageOutcomes(defenders, damageToDefenders),
    ];

    return this.applyDamageOutcomes(outcomes);
  }

  /**
   * Resolve simultaneous multi-unit combat.
   *
   * Algorithm:
   *   1. Sum attacker AP and distribute it across all defenders by current HP ratio
   *   2. Sum defender AP and distribute it across all attackers by current HP ratio
   *   3. Apply both sides' damage simultaneously; remove dead pieces
   *
   * @returns Set of piece IDs that died in this combat round
   */
  static resolveCombat(attackers: Piece[], defenders: Piece[]): { deadIds: Set<number> } {
    const deadIds = new Set<number>();
    if (attackers.length === 0 || defenders.length === 0) return { deadIds };

    const totalDamageToDefender = attackers.reduce((sum, a) => sum + a.attackPowerAgainstPiece, 0);
    const totalDamageToAttacker = defenders.reduce((sum, d) => sum + d.attackPowerAgainstPiece, 0);

    return this.resolveDistributedExchange(
      attackers,
      totalDamageToAttacker,
      defenders,
      totalDamageToDefender,
    );
  }

  /**
   * Resolve the post-wall overflow combat phase.
   *
   * Attacker piece damage is scaled by the wall overflow ratio before this method is called.
   * Defender counterattack uses full piece AP and is applied simultaneously, even if defenders die.
   */
  static resolveOverflowCombat(
    attackers: Piece[],
    defenders: Piece[],
    overflowPieceDamage: number,
  ): { deadIds: Set<number> } {
    const deadIds = new Set<number>();
    if (attackers.length === 0 || defenders.length === 0) return { deadIds };

    const totalDamageToAttackers = defenders.reduce(
      (sum, defender) => sum + defender.attackPowerAgainstPiece,
      0,
    );

    return this.resolveDistributedExchange(
      attackers,
      totalDamageToAttackers,
      defenders,
      overflowPieceDamage,
    );
  }

  /**
   * Distribute damage across a recipient group in proportion to current HP.
   * Damage is applied simultaneously and may leave fractional HP values.
   */
  static distributeDamage(recipients: Piece[], totalDamage: number): { deadIds: Set<number> } {
    return this.applyDamageOutcomes(this.calculateDamageOutcomes(recipients, totalDamage));
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
