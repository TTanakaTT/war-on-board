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
    pieceType: overrides.pieceType ?? PieceType.KNIGHT,
    hp: overrides.hp,
    stackCount: overrides.stackCount,
    maxHp: overrides.maxHp,
  });
}

describe("CombatService", () => {
  beforeEach(() => {
    GameApi.initializeGame({ layer: 4 });
  });

  describe("selectFrontLine", () => {
    test("selects Rook over Knight and Bishop", () => {
      const knight = makePiece({ id: 1, pieceType: PieceType.KNIGHT });
      const rook = makePiece({ id: 2, pieceType: PieceType.ROOK });
      const bishop = makePiece({ id: 3, pieceType: PieceType.BISHOP });
      expect(CombatService.selectFrontLine([knight, rook, bishop])).toBe(rook);
    });

    test("selects Knight over Bishop", () => {
      const knight = makePiece({ id: 1, pieceType: PieceType.KNIGHT });
      const bishop = makePiece({ id: 2, pieceType: PieceType.BISHOP });
      expect(CombatService.selectFrontLine([bishop, knight])).toBe(knight);
    });

    test("selects lowest ID when same type", () => {
      const k1 = makePiece({ id: 5, pieceType: PieceType.KNIGHT });
      const k2 = makePiece({ id: 3, pieceType: PieceType.KNIGHT });
      const k3 = makePiece({ id: 7, pieceType: PieceType.KNIGHT });
      expect(CombatService.selectFrontLine([k1, k2, k3])).toBe(k2);
    });
  });

  describe("resolveCombat", () => {
    test("single attacker vs single defender — both survive with reduced HP", () => {
      // Knight(hp=10, atk=5) vs Rook(hp=10, atk=2)
      const attacker = makePiece({ id: 1, pieceType: PieceType.KNIGHT, hp: 10 });
      const defender = makePiece({ id: 2, pieceType: PieceType.ROOK, hp: 10 });
      PiecesRepository.add(attacker);
      PiecesRepository.add(defender);

      const { deadIds } = CombatService.resolveCombat([attacker], [defender]);
      expect(deadIds.size).toBe(0);
      // Defender took 5 dmg, attacker took 2 dmg
      expect(PiecesRepository.getAll().find((p) => p.id === 2)!.hp).toBe(5);
      expect(PiecesRepository.getAll().find((p) => p.id === 1)!.hp).toBe(8);
    });

    test("single attacker kills defender when damage >= defender HP", () => {
      // Knight(atk=5) vs Rook(hp=5)
      const attacker = makePiece({ id: 1, pieceType: PieceType.KNIGHT, hp: 10 });
      const defender = makePiece({ id: 2, pieceType: PieceType.ROOK, hp: 5 });
      PiecesRepository.add(attacker);
      PiecesRepository.add(defender);

      const { deadIds } = CombatService.resolveCombat([attacker], [defender]);
      expect(deadIds.has(2)).toBe(true);
      expect(PiecesRepository.getAll().find((p) => p.id === 2)).toBeUndefined();
    });

    test("defender counter-attack kills attacker", () => {
      // Knight(hp=2, atk=5) vs Knight(hp=10, atk=5)
      const attacker = makePiece({ id: 1, pieceType: PieceType.KNIGHT, hp: 2 });
      const defender = makePiece({ id: 2, pieceType: PieceType.KNIGHT, hp: 10 });
      PiecesRepository.add(attacker);
      PiecesRepository.add(defender);

      const { deadIds } = CombatService.resolveCombat([attacker], [defender]);
      expect(deadIds.has(1)).toBe(true);
      expect(PiecesRepository.getAll().find((p) => p.id === 1)).toBeUndefined();
    });

    test("both front-line units die simultaneously", () => {
      // Knight(hp=5, atk=5) vs Knight(hp=5, atk=5)
      const attacker = makePiece({ id: 1, pieceType: PieceType.KNIGHT, hp: 5 });
      const defender = makePiece({ id: 2, pieceType: PieceType.KNIGHT, hp: 5 });
      PiecesRepository.add(attacker);
      PiecesRepository.add(defender);

      const { deadIds } = CombatService.resolveCombat([attacker], [defender]);
      expect(deadIds.has(1)).toBe(true);
      expect(deadIds.has(2)).toBe(true);
    });

    test("multi-attacker focuses all damage on front-line defender", () => {
      // 2x Knight(atk=5 each = 10 total) vs Rook(hp=10, front) + Knight(hp=10)
      const a1 = makePiece({ id: 1, pieceType: PieceType.KNIGHT, hp: 10 });
      const a2 = makePiece({ id: 2, pieceType: PieceType.KNIGHT, hp: 10 });
      const d1 = makePiece({ id: 3, pieceType: PieceType.ROOK, hp: 10 }); // front-line
      const d2 = makePiece({ id: 4, pieceType: PieceType.KNIGHT, hp: 10 });
      PiecesRepository.add(a1);
      PiecesRepository.add(a2);
      PiecesRepository.add(d1);
      PiecesRepository.add(d2);

      const { deadIds } = CombatService.resolveCombat([a1, a2], [d1, d2]);
      // Rook(front def) takes 10 dmg → dies
      expect(deadIds.has(3)).toBe(true);
      // Knight(id=4) untouched
      expect(PiecesRepository.getAll().find((p) => p.id === 4)!.hp).toBe(10);
    });

    test("multi-defender counter-damage focuses on front-line attacker", () => {
      // Rook(hp=10, front attacker) + Bishop(hp=5) vs 2x Knight(atk=5 each = 10)
      const a1 = makePiece({ id: 1, pieceType: PieceType.ROOK, hp: 10 }); // front-line attacker
      const a2 = makePiece({ id: 2, pieceType: PieceType.BISHOP, hp: 5 });
      const d1 = makePiece({ id: 3, pieceType: PieceType.KNIGHT, hp: 10 });
      const d2 = makePiece({ id: 4, pieceType: PieceType.KNIGHT, hp: 10 });
      PiecesRepository.add(a1);
      PiecesRepository.add(a2);
      PiecesRepository.add(d1);
      PiecesRepository.add(d2);

      const { deadIds } = CombatService.resolveCombat([a1, a2], [d1, d2]);
      // Front attacker Rook takes 10 dmg → dies
      expect(deadIds.has(1)).toBe(true);
      // Bishop(id=2) untouched
      expect(PiecesRepository.getAll().find((p) => p.id === 2)!.hp).toBe(5);
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
      const attacker = makePiece({ id: 1, pieceType: PieceType.KNIGHT }); // attackWall=2

      CombatService.attackWall(attacker, PanelRepository.find(pos(1, 0))!);
      expect(PanelRepository.find(pos(1, 0))!.castle).toBe(8);
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
      const a1 = makePiece({ id: 1, pieceType: PieceType.KNIGHT }); // attackWall=2
      const a2 = makePiece({ id: 2, pieceType: PieceType.ROOK }); // attackWall=2

      CombatService.attackWallMulti([a1, a2], PanelRepository.find(pos(1, 0))!);
      expect(PanelRepository.find(pos(1, 0))!.castle).toBe(6);
    });

    test("wallDestroyed is true when castle reaches 0", () => {
      const panel = PanelRepository.getAll().find((p) => p.panelPosition.equals(pos(1, 0)))!;
      PanelRepository.update(
        new Panel({
          panelPosition: panel.panelPosition,
          panelState: panel.panelState,
          player: Player.OPPONENT,
          castle: 2,
        }),
      );
      const attacker = makePiece({ id: 1, pieceType: PieceType.KNIGHT }); // attackWall=2

      const result = CombatService.attackWall(attacker, PanelRepository.find(pos(1, 0))!);
      expect(result.wallDestroyed).toBe(true);
      expect(PanelRepository.find(pos(1, 0))!.castle).toBe(0);
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
      const a1 = makePiece({ id: 1, pieceType: PieceType.KNIGHT }); // attackWall=2
      const a2 = makePiece({ id: 2, pieceType: PieceType.ROOK }); // attackWall=2

      CombatService.attackWallMulti([a1, a2], PanelRepository.find(pos(1, 0))!);
      expect(PanelRepository.find(pos(1, 0))!.castle).toBe(0);
    });
  });

  describe("stacked unit (stackCount > 1) combat", () => {
    test("stacked Knight (stackCount=2) has attackPowerAgainstPiece = config.AP + 1", () => {
      const stacked = makePiece({
        id: 1,
        pieceType: PieceType.KNIGHT,
        stackCount: 2,
        maxHp: 20,
        hp: 20,
      });
      // stackCount=2 → AP = 5 + (2-1) = 6
      expect(stacked.attackPowerAgainstPiece).toBe(6);
    });

    test("stacked Knight (stackCount=2) has attackPowerAgainstWall = config.wallAP + 1", () => {
      const stacked = makePiece({
        id: 1,
        pieceType: PieceType.KNIGHT,
        stackCount: 2,
        maxHp: 20,
        hp: 20,
      });
      // stackCount=2 → wall AP = 2 + (2-1) = 3
      expect(stacked.attackPowerAgainstWall).toBe(3);
    });

    test("stacked Knight (stackCount=3) deals config.AP + 2 damage to front-line defender", () => {
      // stackCount=3 Knight: AP = 5 + 2 = 7
      const stacked = makePiece({
        id: 1,
        pieceType: PieceType.KNIGHT,
        stackCount: 3,
        maxHp: 30,
        hp: 30,
      });
      const defender = makePiece({ id: 2, pieceType: PieceType.ROOK, hp: 10 });
      PiecesRepository.add(stacked);
      PiecesRepository.add(defender);

      CombatService.resolveCombat([stacked], [defender]);

      // Rook HP: 10 - 7 = 3
      expect(PiecesRepository.getAll().find((p) => p.id === 2)!.hp).toBe(3);
    });

    test("stacked Knight (stackCount=2) takes counter-attack damage based on defender AP", () => {
      // stackCount=2 Knight: AP = 6, HP = 20
      const stacked = makePiece({
        id: 1,
        pieceType: PieceType.KNIGHT,
        stackCount: 2,
        maxHp: 20,
        hp: 20,
      });
      const defender = makePiece({ id: 2, pieceType: PieceType.KNIGHT, hp: 10 });
      PiecesRepository.add(stacked);
      PiecesRepository.add(defender);

      CombatService.resolveCombat([stacked], [defender]);

      // Stacked Knight HP: 20 - 5 (defender AP) = 15
      expect(PiecesRepository.getAll().find((p) => p.id === 1)!.hp).toBe(15);
      // Defender HP: 10 - 6 (stacked AP) = 4
      expect(PiecesRepository.getAll().find((p) => p.id === 2)!.hp).toBe(4);
    });

    test("stacked Knight (stackCount=2) attacks wall with increased wall AP", () => {
      const panel = PanelRepository.getAll().find((p) => p.panelPosition.equals(pos(1, 0)))!;
      PanelRepository.update(
        new Panel({
          panelPosition: panel.panelPosition,
          panelState: panel.panelState,
          player: Player.OPPONENT,
          castle: 10,
        }),
      );
      // stackCount=2: wall AP = 2 + 1 = 3
      const stacked = makePiece({
        id: 1,
        pieceType: PieceType.KNIGHT,
        stackCount: 2,
        maxHp: 20,
        hp: 20,
      });

      CombatService.attackWall(stacked, PanelRepository.find(pos(1, 0))!);

      expect(PanelRepository.find(pos(1, 0))!.castle).toBe(7); // 10 - 3
    });
  });
});
