import { Piece } from "$lib/domain/entities/Piece";
import { Panel } from "$lib/domain/entities/Panel";
import { PiecesRepository } from "$lib/data/repositories/PieceRepository";
import { PanelRepository } from "$lib/data/repositories/PanelRepository";
import { MatchStatsRepository } from "$lib/data/repositories/MatchStatsRepository";

/**
 * CombatService — handles all combat resolution (piece-vs-piece, piece-vs-wall).
 *
 * Supports multi-unit simultaneous combat:
 *   - Damage = (attack - target's HP-weighted average defense) * attacker's
 *     stackCount, floored at 0, summed per source group
 *   - A defender only counterattacks if its own attackRange reaches the
 *     actual distance to its attacker (e.g. a melee-only defender can't
 *     strike back at a ranged attacker standing further away than it can
 *     reach) — see resolveCombat's `distance` parameter
 *   - Total incoming damage is split across the opposing group by current HP ratio
 *   - Attack and counterattack are applied simultaneously
 *   - Fractional HP is allowed after proportional damage
 */
export class CombatService {
  /**
   * HP-weighted average defense across a group. 0 if the group is empty or
   * has no HP. Used to reduce a multi-unit defending group to a single
   * defense value for damage calculation, independent of the defenders'
   * own merge counts (a defender's stackCount never affects damage taken).
   */
  private static aggregatedDefense(group: Piece[]): number {
    const totalHp = group.reduce((sum, piece) => sum + piece.hp, 0);
    if (totalHp <= 0) return 0;
    return group.reduce((sum, piece) => sum + piece.defense * piece.hp, 0) / totalHp;
  }

  /**
   * Total damage a group of attacking pieces deals against a target whose
   * aggregated defense is `targetDefense`. Per attacker:
   * `max(0, attackPowerAgainstPiece - targetDefense) * stackCount` — merge
   * multiplies attack *count*, not attack power.
   */
  private static groupDamage(source: Piece[], targetDefense: number): number {
    return source.reduce(
      (sum, piece) =>
        sum + Math.max(0, piece.attackPowerAgainstPiece - targetDefense) * piece.stackCount,
      0,
    );
  }

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
        MatchStatsRepository.addDeadUnits(
          outcome.piece.player,
          outcome.piece.pieceType,
          outcome.piece.stackCount,
        );
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
   * Damage formula: for each source group, aggregate the target group's
   * defense by HP-weighted average, then sum `max(0, attack - targetDefense)
   * * stackCount` per attacking piece (merge multiplies hit count, not
   * attack power; a defender's own merge never affects damage taken).
   * The resulting totals are distributed across each recipient group
   * proportionally to current HP, applied simultaneously.
   *
   * `distance` is the panel distance between the attacking and defending
   * groups (defaults to 1 — today's melee combat always happens with the
   * attacker adjacent to, not yet inside, the target panel). Only defenders
   * whose own `attackRange` reaches that distance contribute to the
   * counterattack; defenders still take full damage regardless of range.
   *
   * @returns Set of piece IDs that died in this combat round
   */
  static resolveCombat(
    attackers: Piece[],
    defenders: Piece[],
    distance: number = 1,
  ): { deadIds: Set<number> } {
    const deadIds = new Set<number>();
    if (attackers.length === 0 || defenders.length === 0) return { deadIds };

    const counterEligibleDefenders = defenders.filter((d) => d.attackRange >= distance);

    const defenderDefense = this.aggregatedDefense(defenders);
    const attackerDefense = this.aggregatedDefense(attackers);
    const totalDamageToDefender = this.groupDamage(attackers, defenderDefense);
    const totalDamageToAttacker = this.groupDamage(counterEligibleDefenders, attackerDefense);

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
   * Attacker piece damage uses the normal defense-adjusted formula
   * (see resolveCombat), scaled by `overflowRatio` (the fraction of wall
   * attack power that exceeded the castle's remaining HP). Defender
   * counterattack uses the full defense-adjusted formula, unscaled, and is
   * applied simultaneously, even if defenders die.
   */
  static resolveOverflowCombat(
    attackers: Piece[],
    defenders: Piece[],
    overflowRatio: number,
  ): { deadIds: Set<number> } {
    const deadIds = new Set<number>();
    if (attackers.length === 0 || defenders.length === 0) return { deadIds };

    const defenderDefense = this.aggregatedDefense(defenders);
    const attackerDefense = this.aggregatedDefense(attackers);
    const totalDamageToDefenders = this.groupDamage(attackers, defenderDefense) * overflowRatio;
    const totalDamageToAttackers = this.groupDamage(defenders, attackerDefense);

    return this.resolveDistributedExchange(
      attackers,
      totalDamageToAttackers,
      defenders,
      totalDamageToDefenders,
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
    /**
     * Raw (pre-defense) overflow piece-damage pool — used only to gate
     * whether resolveOverflowCombat should run. The actual damage dealt is
     * recomputed there with the target's defense subtracted.
     */
    overflowPieceDamage: number;
  } {
    const totalWallDamage = attackers.reduce((sum, a) => sum + a.attackPowerAgainstWall, 0);
    const totalPieceDamage = attackers.reduce(
      (sum, a) => sum + a.attackPowerAgainstPiece * a.stackCount,
      0,
    );
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
