import { describe, test, expect, beforeEach } from "vitest";
import { CombatService } from "$lib/services/CombatService";
import { GameApi } from "$lib/api/GameApi";
import { PiecesRepository } from "$lib/data/repositories/PieceRepository";
import { PanelRepository } from "$lib/data/repositories/PanelRepository";
import { Piece } from "$lib/domain/entities/Piece";
import { Panel } from "$lib/domain/entities/Panel";
import { PanelPosition } from "$lib/domain/entities/PanelPosition";
import { PieceType } from "$lib/domain/enums/PieceType";
import { Player } from "$lib/domain/enums/Player";

const pos = (h: number, v: number) => new PanelPosition({ horizontalLayer: h, verticalLayer: v });

function makePiece(
  overrides: Partial<{
    id: number;
    player: Player;
    pieceType: PieceType;
    hp: number;
    stackCount: number;
    maxHp: number;
  }> = {},
): Piece {
  return new Piece({
    id: overrides.id ?? 1,
    panelPosition: pos(0, 0),
    player: overrides.player ?? Player.SELF,
    pieceType: overrides.pieceType ?? PieceType.INFANTRY,
    hp: overrides.hp,
    stackCount: overrides.stackCount,
    maxHp: overrides.maxHp,
  });
}

describe("CombatService", () => {
  beforeEach(() => {
    GameApi.initializeGame({ layer: 4 });
  });

  describe("resolveCombat", () => {
    test("single attacker vs single defender — both survive with reduced HP", () => {
      // Infantry(hp=10, atk=5, def=1) vs Rook(hp=10, atk=2, def=1)
      // Damage = max(0, attack - defense) * stackCount for each direction.
      const attacker = makePiece({ id: 1, pieceType: PieceType.INFANTRY, hp: 10 });
      const defender = makePiece({ id: 2, pieceType: PieceType.ROOK, hp: 10 });
      PiecesRepository.add(attacker);
      PiecesRepository.add(defender);

      const { deadIds } = CombatService.resolveCombat([attacker], [defender]);
      expect(deadIds.size).toBe(0);
      // Defender took (5-1)*1=4 dmg, attacker took (2-1)*1=1 dmg
      expect(PiecesRepository.getAll().find((p) => p.id === 2)!.hp).toBe(6);
      expect(PiecesRepository.getAll().find((p) => p.id === 1)!.hp).toBe(9);
    });

    test("single attacker kills defender when damage >= defender HP", () => {
      // Infantry(atk=5, def=1) vs Rook(hp=4, def=1): damage = (5-1)*1 = 4 = hp, dies.
      const attacker = makePiece({ id: 1, pieceType: PieceType.INFANTRY, hp: 10 });
      const defender = makePiece({ id: 2, pieceType: PieceType.ROOK, hp: 4 });
      PiecesRepository.add(attacker);
      PiecesRepository.add(defender);

      const { deadIds } = CombatService.resolveCombat([attacker], [defender]);
      expect(deadIds.has(2)).toBe(true);
      expect(PiecesRepository.getAll().find((p) => p.id === 2)).toBeUndefined();
    });

    test("defender counter-attack kills attacker", () => {
      // Infantry(hp=2, atk=5, def=1) vs Infantry(hp=10, atk=5, def=1): counter damage = (5-1)*1 = 4 >= 2, dies.
      const attacker = makePiece({ id: 1, pieceType: PieceType.INFANTRY, hp: 2 });
      const defender = makePiece({ id: 2, pieceType: PieceType.INFANTRY, hp: 10 });
      PiecesRepository.add(attacker);
      PiecesRepository.add(defender);

      const { deadIds } = CombatService.resolveCombat([attacker], [defender]);
      expect(deadIds.has(1)).toBe(true);
      expect(PiecesRepository.getAll().find((p) => p.id === 1)).toBeUndefined();
    });

    test("both units die simultaneously when total incoming damage meets their HP", () => {
      // Infantry(hp=4, atk=5, def=1) vs Infantry(hp=4, atk=5, def=1): each deals (5-1)*1=4 >= 4, both die.
      const attacker = makePiece({ id: 1, pieceType: PieceType.INFANTRY, hp: 4 });
      const defender = makePiece({ id: 2, pieceType: PieceType.INFANTRY, hp: 4 });
      PiecesRepository.add(attacker);
      PiecesRepository.add(defender);

      const { deadIds } = CombatService.resolveCombat([attacker], [defender]);
      expect(deadIds.has(1)).toBe(true);
      expect(deadIds.has(2)).toBe(true);
    });

    test("multi-attacker damage is split across defenders in proportion to current HP", () => {
      // 2x Infantry(atk=5, def=1) vs Rook(hp=10, def=1) + Infantry(hp=10, def=1)
      // Aggregated defender defense = 1 (both def=1). Each attacker deals (5-1)*1=4, total=8,
      // split by HP over 20 total → 4 each → hp = 10-4 = 6.
      const a1 = makePiece({ id: 1, pieceType: PieceType.INFANTRY, hp: 10 });
      const a2 = makePiece({ id: 2, pieceType: PieceType.INFANTRY, hp: 10 });
      const d1 = makePiece({ id: 3, pieceType: PieceType.ROOK, hp: 10 });
      const d2 = makePiece({ id: 4, pieceType: PieceType.INFANTRY, hp: 10 });
      PiecesRepository.add(a1);
      PiecesRepository.add(a2);
      PiecesRepository.add(d1);
      PiecesRepository.add(d2);

      const { deadIds } = CombatService.resolveCombat([a1, a2], [d1, d2]);
      expect(deadIds.size).toBe(0);
      expect(PiecesRepository.getAll().find((p) => p.id === 3)!.hp).toBeCloseTo(6);
      expect(PiecesRepository.getAll().find((p) => p.id === 4)!.hp).toBeCloseTo(6);
      // Aggregated attacker defense = 1 (both def=1). Rook deals (2-1)*1=1, Infantry deals (5-1)*1=4,
      // total=5, split by attacker HP over 20 total → 2.5 each → hp = 10-2.5 = 7.5.
      expect(PiecesRepository.getAll().find((p) => p.id === 1)!.hp).toBeCloseTo(7.5);
      expect(PiecesRepository.getAll().find((p) => p.id === 2)!.hp).toBeCloseTo(7.5);
    });

    test("multi-defender counter-damage is split across attackers in proportion to current HP", () => {
      // Rook(hp=10, atk=2, def=1) + Noble(hp=5, atk=0, def=0) vs 2x Infantry(hp=10, atk=5, def=1)
      const a1 = makePiece({ id: 1, pieceType: PieceType.ROOK, hp: 10 });
      const a2 = makePiece({ id: 2, pieceType: PieceType.NOBLE, hp: 5 });
      const d1 = makePiece({ id: 3, pieceType: PieceType.INFANTRY, hp: 10 });
      const d2 = makePiece({ id: 4, pieceType: PieceType.INFANTRY, hp: 10 });
      PiecesRepository.add(a1);
      PiecesRepository.add(a2);
      PiecesRepository.add(d1);
      PiecesRepository.add(d2);

      const { deadIds } = CombatService.resolveCombat([a1, a2], [d1, d2]);
      expect(deadIds.size).toBe(0);
      // Aggregated attacker defense = (1*10 + 0*5)/15 = 2/3. Each Infantry deals (5-2/3)*1=13/3,
      // total=26/3, split by attacker HP (10:5 of 15).
      expect(PiecesRepository.getAll().find((p) => p.id === 1)!.hp).toBeCloseTo(
        10 - (26 / 3) * (10 / 15),
      );
      expect(PiecesRepository.getAll().find((p) => p.id === 2)!.hp).toBeCloseTo(
        5 - (26 / 3) * (5 / 15),
      );
      // Aggregated defender defense = 1 (both def=1). Rook deals (2-1)*1=1, Noble deals max(0,0-1)*1=0,
      // total=1, split by defender HP over 20 total → 0.5 each → hp = 10-0.5 = 9.5.
      expect(PiecesRepository.getAll().find((p) => p.id === 3)!.hp).toBeCloseTo(9.5);
      expect(PiecesRepository.getAll().find((p) => p.id === 4)!.hp).toBeCloseTo(9.5);
    });

    test("distance=1 (default) matches passing it explicitly — no behavior change for melee combat", () => {
      const attacker = makePiece({ id: 1, pieceType: PieceType.INFANTRY, hp: 10 });
      const defender = makePiece({ id: 2, pieceType: PieceType.ROOK, hp: 10 });
      PiecesRepository.add(attacker);
      PiecesRepository.add(defender);

      CombatService.resolveCombat([attacker], [defender], 1);
      expect(PiecesRepository.getAll().find((p) => p.id === 2)!.hp).toBe(6);
      expect(PiecesRepository.getAll().find((p) => p.id === 1)!.hp).toBe(9);
    });

    test("a defender whose attackRange is below distance does not counterattack, but still takes full damage", () => {
      // Rook(attackRange=1) attacked at distance=2 by an Infantry: Rook can't reach back.
      const attacker = makePiece({ id: 1, pieceType: PieceType.INFANTRY, hp: 10 });
      const defender = makePiece({ id: 2, pieceType: PieceType.ROOK, hp: 10 });
      PiecesRepository.add(attacker);
      PiecesRepository.add(defender);

      CombatService.resolveCombat([attacker], [defender], 2);
      // Defender still takes the normal (5-1)*1=4 damage regardless of range.
      expect(PiecesRepository.getAll().find((p) => p.id === 2)!.hp).toBe(6);
      // Attacker takes no counter damage since defender.attackRange(1) < distance(2).
      expect(PiecesRepository.getAll().find((p) => p.id === 1)!.hp).toBe(10);
    });

    test("mixed defenders: only the ones whose attackRange reaches the distance contribute to the counterattack", () => {
      // Attacker at distance=2. Defender A has attackRange=1 (can't reach), defender B has attackRange=2 (can).
      const attacker = makePiece({ id: 1, pieceType: PieceType.INFANTRY, hp: 10 });
      const shortRangeDefender = makePiece({ id: 2, pieceType: PieceType.ROOK, hp: 10 }); // attackRange=1
      const longRangeDefender = new Piece({
        id: 3,
        panelPosition: pos(0, 0),
        player: Player.OPPONENT,
        pieceType: PieceType.ROOK,
        hp: 10,
      });
      Object.defineProperty(longRangeDefender, "attackRange", { value: 2 });
      PiecesRepository.add(attacker);
      PiecesRepository.add(shortRangeDefender);
      PiecesRepository.add(longRangeDefender);

      CombatService.resolveCombat([attacker], [shortRangeDefender, longRangeDefender], 2);

      // Only longRangeDefender's (2-1)*1=1 damage counts toward the counterattack, distributed by HP
      // across the sole attacker: attacker.hp = 10 - 1 = 9.
      expect(PiecesRepository.getAll().find((p) => p.id === 1)!.hp).toBeCloseTo(9);
    });

    test("returns empty deadIds when attackers array is empty", () => {
      const defender = makePiece({ id: 1 });
      PiecesRepository.add(defender);
      const { deadIds } = CombatService.resolveCombat([], [defender]);
      expect(deadIds.size).toBe(0);
    });

    test("returns empty deadIds when defenders array is empty", () => {
      const attacker = makePiece({ id: 1 });
      PiecesRepository.add(attacker);
      const { deadIds } = CombatService.resolveCombat([attacker], []);
      expect(deadIds.size).toBe(0);
    });
  });

  describe("attackWall / attackWallMulti", () => {
    test("single attacker reduces castle HP by attackPowerAgainstWall", () => {
      const panel = PanelRepository.getAll().find((p) => p.panelPosition.equals(pos(1, 0)))!;
      PanelRepository.update(
        new Panel({
          panelPosition: panel.panelPosition,
          panelState: panel.panelState,
          player: Player.OPPONENT,
          castle: 10,
        }),
      );
      const attacker = makePiece({ id: 1, pieceType: PieceType.INFANTRY }); // attackWall=1

      CombatService.attackWall(attacker, PanelRepository.find(pos(1, 0))!);
      expect(PanelRepository.find(pos(1, 0))!.castle).toBe(9);
    });

    test("multi-attacker sums wall damage from all attackers", () => {
      const panel = PanelRepository.getAll().find((p) => p.panelPosition.equals(pos(1, 0)))!;
      PanelRepository.update(
        new Panel({
          panelPosition: panel.panelPosition,
          panelState: panel.panelState,
          player: Player.OPPONENT,
          castle: 10,
        }),
      );
      const a1 = makePiece({ id: 1, pieceType: PieceType.INFANTRY }); // attackWall=1
      const a2 = makePiece({ id: 2, pieceType: PieceType.ROOK }); // attackWall=2

      CombatService.attackWallMulti([a1, a2], PanelRepository.find(pos(1, 0))!);
      expect(PanelRepository.find(pos(1, 0))!.castle).toBe(7);
    });

    test("wallDestroyed is true when castle reaches 0", () => {
      const panel = PanelRepository.getAll().find((p) => p.panelPosition.equals(pos(1, 0)))!;
      PanelRepository.update(
        new Panel({
          panelPosition: panel.panelPosition,
          panelState: panel.panelState,
          player: Player.OPPONENT,
          castle: 1,
        }),
      );
      const attacker = makePiece({ id: 1, pieceType: PieceType.INFANTRY }); // attackWall=1

      const result = CombatService.attackWall(attacker, PanelRepository.find(pos(1, 0))!);
      expect(result.wallDestroyed).toBe(true);
      expect(PanelRepository.find(pos(1, 0))!.castle).toBe(0);
      expect(result.wallDamageDealt).toBe(1);
      expect(result.overflowRatio).toBe(0);
      expect(result.overflowPieceDamage).toBe(0);
    });

    test("castle does not go below 0", () => {
      const panel = PanelRepository.getAll().find((p) => p.panelPosition.equals(pos(1, 0)))!;
      PanelRepository.update(
        new Panel({
          panelPosition: panel.panelPosition,
          panelState: panel.panelState,
          player: Player.OPPONENT,
          castle: 1,
        }),
      );
      const a1 = makePiece({ id: 1, pieceType: PieceType.INFANTRY }); // attackWall=1
      const a2 = makePiece({ id: 2, pieceType: PieceType.ROOK }); // attackWall=2

      CombatService.attackWallMulti([a1, a2], PanelRepository.find(pos(1, 0))!);
      expect(PanelRepository.find(pos(1, 0))!.castle).toBe(0);
    });

    test("overflow wall damage is converted into scaled piece damage", () => {
      const panel = PanelRepository.getAll().find((p) => p.panelPosition.equals(pos(1, 0)))!;
      PanelRepository.update(
        new Panel({
          panelPosition: panel.panelPosition,
          panelState: panel.panelState,
          player: Player.OPPONENT,
          // castle=0.5 < attackPowerAgainstWall(1) so a single attacker overflows.
          castle: 0.5,
        }),
      );
      const attacker = makePiece({ id: 1, pieceType: PieceType.INFANTRY });

      const result = CombatService.attackWall(attacker, PanelRepository.find(pos(1, 0))!);

      expect(result.wallDestroyed).toBe(true);
      expect(result.wallDamageDealt).toBe(0.5);
      expect(result.overflowRatio).toBe(0.5);
      // overflowPieceDamage is the raw (pre-defense) gate value: attackPowerAgainstPiece(5) * overflowRatio(0.5)
      expect(result.overflowPieceDamage).toBe(2.5);
    });
  });

  describe("distributeDamage", () => {
    test("deals all damage to the only recipient", () => {
      const recipient = makePiece({ id: 1, player: Player.OPPONENT, hp: 10 });
      PiecesRepository.add(recipient);

      const { deadIds } = CombatService.distributeDamage([recipient], 2.5);

      expect(deadIds.size).toBe(0);
      expect(PiecesRepository.getAll().find((p) => p.id === 1)!.hp).toBeCloseTo(7.5);
    });

    test("splits damage across recipients in proportion to their current HP", () => {
      const recipientA = new Piece({
        id: 1,
        panelPosition: pos(1, 0),
        initialPosition: pos(1, 0),
        player: Player.OPPONENT,
        pieceType: PieceType.INFANTRY,
        hp: 6,
      });
      const recipientB = new Piece({
        id: 2,
        panelPosition: pos(1, 0),
        initialPosition: pos(1, 0),
        player: Player.OPPONENT,
        pieceType: PieceType.ROOK,
        hp: 4,
      });
      PiecesRepository.add(recipientA);
      PiecesRepository.add(recipientB);

      const { deadIds } = CombatService.distributeDamage([recipientA, recipientB], 5);

      expect(deadIds.size).toBe(0);
      expect(PiecesRepository.getAll().find((p) => p.id === 1)!.hp).toBeCloseTo(3);
      expect(PiecesRepository.getAll().find((p) => p.id === 2)!.hp).toBeCloseTo(2);
    });
  });

  describe("resolveOverflowCombat", () => {
    test("applies scaled overflow damage to defenders and full counterattack to attackers", () => {
      // Infantry(hp=10, atk=5, def=1) vs Infantry(hp=10, atk=5, def=1), overflowRatio=0.5
      const attacker = makePiece({ id: 1, pieceType: PieceType.INFANTRY, hp: 10 });
      const defender = makePiece({
        id: 2,
        player: Player.OPPONENT,
        pieceType: PieceType.INFANTRY,
        hp: 10,
      });
      PiecesRepository.add(attacker);
      PiecesRepository.add(defender);

      const { deadIds } = CombatService.resolveOverflowCombat([attacker], [defender], 0.5);

      expect(deadIds.size).toBe(0);
      // Counterattack (unscaled): (5-1)*1 = 4 → hp = 10-4 = 6
      expect(PiecesRepository.getAll().find((p) => p.id === 1)!.hp).toBeCloseTo(6);
      // Overflow damage (scaled): (5-1)*1*0.5 = 2 → hp = 10-2 = 8
      expect(PiecesRepository.getAll().find((p) => p.id === 2)!.hp).toBeCloseTo(8);
    });

    test("defenders still counterattack during overflow even if they are removed", () => {
      const attacker = makePiece({ id: 1, pieceType: PieceType.INFANTRY, hp: 4 });
      const defender = makePiece({
        id: 2,
        player: Player.OPPONENT,
        pieceType: PieceType.INFANTRY,
        hp: 2,
      });
      PiecesRepository.add(attacker);
      PiecesRepository.add(defender);

      // overflowRatio=1: overflow damage = (5-1)*1*1 = 4 >= 2, defender dies.
      // Counterattack (unscaled): (5-1)*1 = 4 >= 4, attacker also dies.
      const { deadIds } = CombatService.resolveOverflowCombat([attacker], [defender], 1);

      expect(deadIds.has(1)).toBe(true);
      expect(deadIds.has(2)).toBe(true);
      expect(PiecesRepository.getAll().find((p) => p.id === 1)).toBeUndefined();
      expect(PiecesRepository.getAll().find((p) => p.id === 2)).toBeUndefined();
    });
  });

  describe("stacked unit (stackCount > 1) combat", () => {
    test("stacked Infantry (stackCount=2) attackPowerAgainstPiece stays at the raw config value", () => {
      const stacked = makePiece({
        id: 1,
        pieceType: PieceType.INFANTRY,
        stackCount: 2,
        maxHp: 20,
        hp: 20,
      });
      // Merge multiplies hit count, not attack power — AP stays at config(5).
      expect(stacked.attackPowerAgainstPiece).toBe(5);
    });

    test("stacked Infantry (stackCount=2) attackPowerAgainstWall scales by stackCount", () => {
      const stacked = makePiece({
        id: 1,
        pieceType: PieceType.INFANTRY,
        stackCount: 2,
        maxHp: 20,
        hp: 20,
      });
      // Walls have no defense stat, so wall AP scales directly: config(1) * stackCount(2) = 2
      expect(stacked.attackPowerAgainstWall).toBe(2);
    });

    test("stacked Infantry (stackCount=3) deals (attack - defense) * stackCount damage to a single defender", () => {
      // stackCount=3 Infantry vs Rook(def=1): damage = (5-1)*3 = 12
      const stacked = makePiece({
        id: 1,
        pieceType: PieceType.INFANTRY,
        stackCount: 3,
        maxHp: 30,
        hp: 30,
      });
      const defender = makePiece({ id: 2, pieceType: PieceType.ROOK, hp: 20 });
      PiecesRepository.add(stacked);
      PiecesRepository.add(defender);

      CombatService.resolveCombat([stacked], [defender]);

      // Rook HP: 20 - 12 = 8
      expect(PiecesRepository.getAll().find((p) => p.id === 2)!.hp).toBe(8);
    });

    test("stacked Infantry (stackCount=2) takes counter-attack damage based on defender AP minus its own defense", () => {
      // stackCount=2 Infantry (AP stays 5, def=1) vs Infantry defender (atk=5, def=1, stackCount=1)
      const stacked = makePiece({
        id: 1,
        pieceType: PieceType.INFANTRY,
        stackCount: 2,
        maxHp: 20,
        hp: 20,
      });
      const defender = makePiece({ id: 2, pieceType: PieceType.INFANTRY, hp: 10 });
      PiecesRepository.add(stacked);
      PiecesRepository.add(defender);

      CombatService.resolveCombat([stacked], [defender]);

      // Stacked Infantry HP: damage taken = (defender.atk(5) - stacked.def(1)) * defender.stackCount(1) = 4
      // → 20 - 4 = 16
      expect(PiecesRepository.getAll().find((p) => p.id === 1)!.hp).toBe(16);
      // Defender HP: damage taken = (stacked.atk(5) - defender.def(1)) * stacked.stackCount(2) = 8
      // → 10 - 8 = 2
      expect(PiecesRepository.getAll().find((p) => p.id === 2)!.hp).toBe(2);
    });

    test("stacked Infantry (stackCount=2) attacks wall with wall AP scaled by stackCount", () => {
      const panel = PanelRepository.getAll().find((p) => p.panelPosition.equals(pos(1, 0)))!;
      PanelRepository.update(
        new Panel({
          panelPosition: panel.panelPosition,
          panelState: panel.panelState,
          player: Player.OPPONENT,
          castle: 10,
        }),
      );
      // stackCount=2: wall AP = config(1) * 2 = 2
      const stacked = makePiece({
        id: 1,
        pieceType: PieceType.INFANTRY,
        stackCount: 2,
        maxHp: 20,
        hp: 20,
      });

      CombatService.attackWall(stacked, PanelRepository.find(pos(1, 0))!);

      expect(PanelRepository.find(pos(1, 0))!.castle).toBe(8); // 10 - 2
    });
  });
});
