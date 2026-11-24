import {
  pieceConfig,
  stackCountForHp,
  wallAttackPower,
  type Panel,
  type Piece,
} from "#lib/domain/model.ts";
import { MatchStatsRepository, PanelRepository, PiecesRepository } from "#lib/store.svelte.ts";

const attackOf = (piece: Piece) => pieceConfig(piece.pieceType).attackPowerAgainstPiece;

/**
 * Simultaneous group combat: each side deals sum(max(0, attack - target HP-weighted defense)
 * * stackCount), split across the other side in proportion to HP (fractional HP allowed).
 * A piece loses a unit each time its HP crosses a multiple of the type's maxHp.
 */
export class CombatService {
  private static aggregatedDefense(group: Piece[]): number {
    const totalHp = group.reduce((sum, p) => sum + p.hp, 0);
    if (totalHp <= 0) return 0;
    return group.reduce((sum, p) => sum + pieceConfig(p.pieceType).defense * p.hp, 0) / totalHp;
  }

  private static groupDamage(source: Piece[], targetDefense: number): number {
    return source.reduce(
      (sum, p) => sum + Math.max(0, attackOf(p) - targetDefense) * p.stackCount,
      0,
    );
  }

  private static damageOutcomes(recipients: Piece[], totalDamage: number) {
    const totalHp = recipients.reduce((sum, p) => sum + p.hp, 0);
    if (recipients.length === 0 || totalDamage <= 0 || totalHp <= 0) return [];
    return recipients.map((piece) => ({
      piece,
      newHp: piece.hp - totalDamage * (piece.hp / totalHp),
    }));
  }

  private static applyDamage(outcomes: { piece: Piece; newHp: number }[]) {
    const deadIds = new Set<number>();
    for (const { piece, newHp } of outcomes) {
      const stackCount = stackCountForHp(piece.pieceType, newHp);
      MatchStatsRepository.addLostUnits(
        piece.player,
        piece.pieceType,
        piece.stackCount - stackCount,
      );
      if (stackCount > 0) {
        PiecesRepository.update({ ...piece, hp: newHp, stackCount });
        continue;
      }
      PiecesRepository.remove(piece);
      deadIds.add(piece.id);
    }
    return { deadIds };
  }

  private static exchange(
    attackers: Piece[],
    defenders: Piece[],
    toDefenders: number,
    toAttackers: number,
  ) {
    return this.applyDamage([
      ...this.damageOutcomes(attackers, toAttackers),
      ...this.damageOutcomes(defenders, toDefenders),
    ]);
  }

  /** Only defenders whose attackRange reaches <distance> counterattack. */
  static resolveCombat(attackers: Piece[], defenders: Piece[], distance = 1) {
    if (attackers.length === 0 || defenders.length === 0) return { deadIds: new Set<number>() };
    const counter = defenders.filter((d) => pieceConfig(d.pieceType).attackRange >= distance);
    return this.exchange(
      attackers,
      defenders,
      this.groupDamage(attackers, this.aggregatedDefense(defenders)),
      this.groupDamage(counter, this.aggregatedDefense(attackers)),
    );
  }

  /** After a wall breaks: attacker damage scaled by <overflowRatio>; defenders counter in full. */
  static resolveOverflowCombat(attackers: Piece[], defenders: Piece[], overflowRatio: number) {
    if (attackers.length === 0 || defenders.length === 0) return { deadIds: new Set<number>() };
    return this.exchange(
      attackers,
      defenders,
      this.groupDamage(attackers, this.aggregatedDefense(defenders)) * overflowRatio,
      this.groupDamage(defenders, this.aggregatedDefense(attackers)),
    );
  }

  static distributeDamage(recipients: Piece[], totalDamage: number) {
    return this.applyDamage(this.damageOutcomes(recipients, totalDamage));
  }

  /** `overflowPieceDamage` is a raw pool used only to decide whether overflow combat runs. */
  static attackWallMulti(attackers: Piece[], panel: Panel) {
    const totalWallDamage = attackers.reduce((sum, a) => sum + wallAttackPower(a), 0);
    const totalPieceDamage = attackers.reduce((sum, a) => sum + attackOf(a) * a.stackCount, 0);
    const overflow = Math.max(0, totalWallDamage - panel.wall);
    const overflowRatio = totalWallDamage === 0 ? 0 : overflow / totalWallDamage;
    const wall = Math.max(0, panel.wall - totalWallDamage);
    PanelRepository.update({ ...panel, wall });
    return {
      wallDestroyed: wall <= 0,
      wallDamageDealt: Math.min(panel.wall, totalWallDamage),
      overflowRatio,
      overflowPieceDamage: totalPieceDamage * overflowRatio,
    };
  }
}
