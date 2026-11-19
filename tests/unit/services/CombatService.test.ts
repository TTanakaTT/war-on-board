import { beforeEach, describe, expect, test } from "vitest";
import { PieceType, Player } from "#lib/domain/model.ts";
import { CombatService as C } from "#lib/services/CombatService.ts";
import { add, exists, newGame, panel, piece, pos, setPanel } from "../helpers.ts";

const attacker = (id: number, overrides = {}) => add(id, pos(0, 0), Player.SELF, overrides);
const defender = (id: number, overrides = {}) => add(id, pos(0, 1), Player.OPPONENT, overrides);

beforeEach(() => newGame(4));

describe("CombatService", () => {
  test("both sides deal (attack - defense) * stackCount at once", () => {
    const a = attacker(1, { stackCount: 3, hp: 30, maxHp: 30 });
    const d = defender(2, { pieceType: PieceType.ROOK, hp: 10 });
    C.resolveCombat([a], [d]);
    expect(exists(2)).toBe(false);
    expect(piece(1).hp).toBe(30 - (2 - 1));
  });

  test("damage is split by current HP and simultaneous deaths are possible", () => {
    const a = [attacker(1), attacker(2, { pieceType: PieceType.CAVALRY })];
    const d = [defender(3, { hp: 4 }), defender(4, { hp: 8 })];
    const { deadIds } = C.resolveCombat(a, d);
    // Defenders take 4 + 7 = 11 split 4:8; attackers take 4 + 4 = 8 split 10:12.
    expect([...deadIds]).toEqual([]);
    expect(piece(3).hp).toBeCloseTo(4 - 11 / 3);
    expect(piece(4).hp).toBeCloseTo(8 - 22 / 3);
    expect(piece(1).hp).toBeCloseTo(10 - 80 / 22);

    const mutual = C.resolveCombat([attacker(5, { hp: 4 })], [defender(6, { hp: 4 })]);
    expect([...mutual.deadIds].sort()).toEqual([5, 6]);
  });

  test("only defenders whose range reaches the distance counter", () => {
    const a = attacker(1);
    C.resolveCombat(
      [a],
      [defender(2, { pieceType: PieceType.ROOK }), defender(3, { pieceType: PieceType.ARCHER })],
      2,
    );
    expect(piece(1).hp).toBe(10 - (4 - 1));
    expect(C.resolveCombat([], [defender(4)]).deadIds.size).toBe(0);
  });

  test("walls take the summed wall power (scaled by stack) and never go below 0", () => {
    setPanel(pos(0, 1), { player: Player.OPPONENT, castle: 3 });
    const result = C.attackWallMulti(
      [attacker(1, { stackCount: 2 }), attacker(2)],
      panel(pos(0, 1)),
    );
    expect(result).toMatchObject({ wallDestroyed: true, wallDamageDealt: 3, overflowRatio: 0 });
    expect(panel(pos(0, 1)).castle).toBe(0);
    setPanel(pos(0, 1), { castle: 0.5 });
    expect(C.attackWallMulti([attacker(3)], panel(pos(0, 1)))).toMatchObject({
      overflowRatio: 0.5,
      overflowPieceDamage: 2.5,
    });
  });

  test("overflow scales attacker damage; defenders counter in full even when they die", () => {
    const { deadIds } = C.resolveOverflowCombat([attacker(1)], [defender(2, { hp: 1 })], 0.5);
    expect([...deadIds]).toEqual([2]);
    expect(piece(1).hp).toBe(6);
  });

  test("distributeDamage splits by HP and records deaths in match stats", () => {
    C.distributeDamage([defender(1, { hp: 2 }), defender(2, { hp: 6 })], 4);
    expect(piece(2).hp).toBe(3);
    expect(exists(1)).toBe(true);
    C.distributeDamage([piece(1)], 99);
    expect(exists(1)).toBe(false);
  });
});
