import { beforeEach, describe, test, expect } from "vitest";
import { GameApi } from "$lib/api/GameApi";
import { PieceService } from "$lib/services/PieceService";
import { PiecesRepository } from "$lib/data/repositories/PieceRepository";
import { PanelRepository } from "$lib/data/repositories/PanelRepository";
import { Piece } from "$lib/domain/entities/Piece";
import { Panel } from "$lib/domain/entities/Panel";
import { PanelPosition } from "$lib/domain/entities/PanelPosition";
import { PieceType } from "$lib/domain/enums/PieceType";
import { Player } from "$lib/domain/enums/Player";
import {
  PASSIVE_RESOURCE_CAP,
  PASSIVE_CASTLE_CAP,
  HOME_BASE_INIT_CASTLE,
} from "$lib/domain/constants/GameConstants";

const pos = (h: number, v: number) => new PanelPosition({ horizontalLayer: h, verticalLayer: v });

const makePiece = (
  overrides: Partial<ConstructorParameters<typeof Piece>[0]> & {
    panelPosition: PanelPosition;
    player: Player;
    pieceType: PieceType;
  },
) =>
  new Piece({
    id: 0,
    ...overrides,
  });

describe("PieceService", () => {
  beforeEach(() => {
    GameApi.initializeGame({ layer: 4 });
  });

  describe("generateNextId", () => {
    test("returns 1 when no pieces exist", () => {
      expect(PieceService.generateNextId()).toBe(1);
    });

    test("returns max existing id + 1", () => {
      PiecesRepository.add(
        makePiece({
          id: 5,
          panelPosition: pos(0, 0),
          player: Player.SELF,
          pieceType: PieceType.INFANTRY,
        }),
      );
      PiecesRepository.add(
        makePiece({
          id: 3,
          panelPosition: pos(0, 1),
          player: Player.SELF,
          pieceType: PieceType.INFANTRY,
        }),
      );
      expect(PieceService.generateNextId()).toBe(6);
    });
  });

  describe("move", () => {
    test("updates piece to new position and clears targetPosition", () => {
      const piece = makePiece({
        id: 1,
        panelPosition: pos(-2, 0),
        targetPosition: pos(-1, 0),
        player: Player.SELF,
        pieceType: PieceType.INFANTRY,
      });
      PiecesRepository.add(piece);
      PieceService.move(pos(-1, 0), piece);
      const updated = PiecesRepository.getAll().find((p) => p.id === 1)!;
      expect(updated.panelPosition.equals(pos(-1, 0))).toBe(true);
      expect(updated.targetPosition).toBeUndefined();
    });

    test("sets initialPosition to new panelPosition after move", () => {
      const piece = makePiece({
        id: 1,
        panelPosition: pos(-2, 0),
        player: Player.SELF,
        pieceType: PieceType.INFANTRY,
      });
      PiecesRepository.add(piece);
      PieceService.move(pos(-1, 0), piece);
      const updated = PiecesRepository.getAll().find((p) => p.id === 1)!;
      expect(updated.initialPosition.equals(pos(-1, 0))).toBe(true);
    });

    test("preserves piece id, player, pieceType, and hp", () => {
      const piece = makePiece({
        id: 7,
        panelPosition: pos(-2, 0),
        player: Player.SELF,
        pieceType: PieceType.ROOK,
        hp: 8,
      });
      PiecesRepository.add(piece);
      PieceService.move(pos(-1, 0), piece);
      const updated = PiecesRepository.getAll().find((p) => p.id === 7)!;
      expect(updated.id).toBe(7);
      expect(updated.player).toBe(Player.SELF);
      expect(updated.pieceType).toBe(PieceType.ROOK);
      expect(updated.hp).toBe(8);
    });

    test("preserves stackCount and maxHp after move", () => {
      const piece = makePiece({
        id: 1,
        panelPosition: pos(-2, 0),
        player: Player.SELF,
        pieceType: PieceType.INFANTRY,
        hp: 20,
        stackCount: 2,
        maxHp: 20,
      });
      PiecesRepository.add(piece);
      PieceService.move(pos(-1, 0), piece);
      const updated = PiecesRepository.getAll().find((p) => p.id === 1)!;
      expect(updated.stackCount).toBe(2);
      expect(updated.maxHp).toBe(20);
      expect(updated.hp).toBe(20);
    });

    test("spends MOVEMENT_HOP_COST (1) of movementPoints per move", () => {
      const piece = makePiece({
        id: 1,
        panelPosition: pos(-2, 0),
        player: Player.SELF,
        pieceType: PieceType.INFANTRY,
        movementPoints: 1,
      });
      PiecesRepository.add(piece);
      PieceService.move(pos(-1, 0), piece);
      const updated = PiecesRepository.getAll().find((p) => p.id === 1)!;
      expect(updated.movementPoints).toBe(0);
    });
  });

  describe("computeAccruedMovementPoints", () => {
    test("refills to the cap each turn when movementRate=1 (matches today's real units)", () => {
      expect(PieceService.computeAccruedMovementPoints(0, 1)).toBe(1);
      expect(PieceService.computeAccruedMovementPoints(1, 1)).toBe(1);
    });

    test("caps at movementRate=2 (future Cavalry) instead of accumulating indefinitely", () => {
      expect(PieceService.computeAccruedMovementPoints(0, 2)).toBe(2);
      expect(PieceService.computeAccruedMovementPoints(2, 2)).toBe(2);
    });

    test("fractional movementRate=0.5 (future Heavy) takes two turns to reach the 1-point cap", () => {
      const afterTurn1 = PieceService.computeAccruedMovementPoints(0, 0.5);
      expect(afterTurn1).toBe(0.5);
      const afterTurn2 = PieceService.computeAccruedMovementPoints(afterTurn1, 0.5);
      expect(afterTurn2).toBe(1);
      // Further idle turns don't exceed the cap.
      expect(PieceService.computeAccruedMovementPoints(afterTurn2, 0.5)).toBe(1);
    });

    test("fractional movementRate=0.25 (hypothetical slower unit) takes four turns to reach the 1-point cap", () => {
      let points = 0;
      const perTurn: number[] = [];
      for (let turn = 0; turn < 4; turn++) {
        points = PieceService.computeAccruedMovementPoints(points, 0.25);
        perTurn.push(points);
      }
      expect(perTurn).toEqual([0.25, 0.5, 0.75, 1]);
      // Further idle turns don't exceed the cap.
      expect(PieceService.computeAccruedMovementPoints(points, 0.25)).toBe(1);
    });
  });

  describe("accrueMovementForPlayer", () => {
    test("restores a spent movement point back to the cap for every player piece", () => {
      const piece = makePiece({
        id: 1,
        panelPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.INFANTRY,
        movementPoints: 0,
      });
      PiecesRepository.add(piece);
      PieceService.accrueMovementForPlayer(Player.SELF);
      const updated = PiecesRepository.getAll().find((p) => p.id === 1)!;
      expect(updated.movementPoints).toBe(1);
    });

    test("does not affect the other player's pieces", () => {
      const oppPiece = makePiece({
        id: 1,
        panelPosition: pos(0, 0),
        player: Player.OPPONENT,
        pieceType: PieceType.INFANTRY,
        movementPoints: 0,
      });
      PiecesRepository.add(oppPiece);
      PieceService.accrueMovementForPlayer(Player.SELF);
      const updated = PiecesRepository.getAll().find((p) => p.id === 1)!;
      expect(updated.movementPoints).toBe(0);
    });
  });

  describe("resetInitialPositions", () => {
    test("sets initialPosition to current panelPosition for all player pieces", () => {
      const piece = makePiece({
        id: 1,
        panelPosition: pos(-1, 0),
        initialPosition: pos(-2, 0),
        player: Player.SELF,
        pieceType: PieceType.INFANTRY,
      });
      PiecesRepository.add(piece);
      PieceService.resetInitialPositions(Player.SELF);
      const updated = PiecesRepository.getAll().find((p) => p.id === 1)!;
      expect(updated.initialPosition.equals(pos(-1, 0))).toBe(true);
    });

    test("does not affect opponent pieces", () => {
      const selfPiece = makePiece({
        id: 1,
        panelPosition: pos(-1, 0),
        initialPosition: pos(-2, 0),
        player: Player.SELF,
        pieceType: PieceType.INFANTRY,
      });
      const oppPiece = makePiece({
        id: 2,
        panelPosition: pos(1, 0),
        initialPosition: pos(2, 0),
        player: Player.OPPONENT,
        pieceType: PieceType.INFANTRY,
      });
      PiecesRepository.add(selfPiece);
      PiecesRepository.add(oppPiece);
      PieceService.resetInitialPositions(Player.SELF);
      const oppUpdated = PiecesRepository.getAll().find((p) => p.id === 2)!;
      expect(oppUpdated.initialPosition.equals(pos(2, 0))).toBe(true);
    });
  });

  describe("applyPassiveGains", () => {
    test("NOBLE increases panel resource by 1", () => {
      const noble = makePiece({
        id: 1,
        panelPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.NOBLE,
      });
      PiecesRepository.add(noble);
      const panel = PanelRepository.find(pos(0, 0))!;
      PanelRepository.update(new Panel({ ...panel, player: Player.SELF, resource: 0 }));
      PieceService.applyPassiveGains(Player.SELF);
      expect(PanelRepository.find(pos(0, 0))!.resource).toBe(1);
    });

    test("NOBLE resource gain is capped at PASSIVE_RESOURCE_CAP", () => {
      const noble = makePiece({
        id: 1,
        panelPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.NOBLE,
      });
      PiecesRepository.add(noble);
      const panel = PanelRepository.find(pos(0, 0))!;
      PanelRepository.update(
        new Panel({ ...panel, player: Player.SELF, resource: PASSIVE_RESOURCE_CAP }),
      );
      PieceService.applyPassiveGains(Player.SELF);
      expect(PanelRepository.find(pos(0, 0))!.resource).toBe(PASSIVE_RESOURCE_CAP);
    });

    test("ROOK increases panel castle by 1", () => {
      const rook = makePiece({
        id: 1,
        panelPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.ROOK,
      });
      PiecesRepository.add(rook);
      const panel = PanelRepository.find(pos(0, 0))!;
      PanelRepository.update(new Panel({ ...panel, player: Player.SELF, castle: 0 }));
      PieceService.applyPassiveGains(Player.SELF);
      expect(PanelRepository.find(pos(0, 0))!.castle).toBe(1);
    });

    test("ROOK castle gain is capped at PASSIVE_CASTLE_CAP", () => {
      const rook = makePiece({
        id: 1,
        panelPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.ROOK,
      });
      PiecesRepository.add(rook);
      const panel = PanelRepository.find(pos(0, 0))!;
      PanelRepository.update(
        new Panel({ ...panel, player: Player.SELF, castle: PASSIVE_CASTLE_CAP }),
      );
      PieceService.applyPassiveGains(Player.SELF);
      expect(PanelRepository.find(pos(0, 0))!.castle).toBe(PASSIVE_CASTLE_CAP);
    });

    test("ROOK preserves existing castle value above cap", () => {
      const rook = makePiece({
        id: 1,
        panelPosition: pos(-3, 0),
        player: Player.SELF,
        pieceType: PieceType.ROOK,
      });
      PiecesRepository.add(rook);
      // Home base castle = HOME_BASE_INIT_CASTLE (10) which is above PASSIVE_CASTLE_CAP (5)
      const panel = PanelRepository.find(pos(-3, 0))!;
      expect(panel.castle).toBe(HOME_BASE_INIT_CASTLE);
      PieceService.applyPassiveGains(Player.SELF);
      expect(PanelRepository.find(pos(-3, 0))!.castle).toBe(HOME_BASE_INIT_CASTLE);
    });

    test("INFANTRY sets panel player to piece owner", () => {
      const infantry = makePiece({
        id: 1,
        panelPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.INFANTRY,
      });
      PiecesRepository.add(infantry);
      const panel = PanelRepository.find(pos(0, 0))!;
      expect(panel.player).toBe(Player.UNKNOWN);
      PieceService.applyPassiveGains(Player.SELF);
      expect(PanelRepository.find(pos(0, 0))!.player).toBe(Player.SELF);
    });

    test("skips piece when panel is not found", () => {
      // Piece at a position not on the board - should not throw
      const piece = makePiece({
        id: 1,
        panelPosition: pos(99, 99),
        player: Player.SELF,
        pieceType: PieceType.INFANTRY,
      });
      PiecesRepository.add(piece);
      expect(() => PieceService.applyPassiveGains(Player.SELF)).not.toThrow();
    });
  });

  describe("finalizePlayerMoves", () => {
    test("returns empty array when no pieces have pending moves", () => {
      const piece = makePiece({
        id: 1,
        panelPosition: pos(-2, 0),
        player: Player.SELF,
        pieceType: PieceType.INFANTRY,
      });
      PiecesRepository.add(piece);
      const outcomes = PieceService.finalizePlayerMoves(Player.SELF);
      expect(outcomes).toEqual([]);
    });

    test("moves piece to target panel when target is unoccupied", () => {
      const piece = makePiece({
        id: 1,
        panelPosition: pos(-2, 0),
        targetPosition: pos(-1, 0),
        player: Player.SELF,
        pieceType: PieceType.INFANTRY,
      });
      PiecesRepository.add(piece);
      const outcomes = PieceService.finalizePlayerMoves(Player.SELF);
      // No combat on empty panel
      expect(outcomes).toEqual([]);
      const moved = PiecesRepository.getAll().find((p) => p.id === 1)!;
      expect(moved.panelPosition.equals(pos(-1, 0))).toBe(true);
    });

    test("resolves combat when target has enemy pieces", () => {
      const attacker = makePiece({
        id: 1,
        panelPosition: pos(-1, 0),
        targetPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.INFANTRY,
      });
      const defender = makePiece({
        id: 2,
        panelPosition: pos(0, 0),
        player: Player.OPPONENT,
        pieceType: PieceType.INFANTRY,
      });
      PiecesRepository.add(attacker);
      PiecesRepository.add(defender);
      const outcomes = PieceService.finalizePlayerMoves(Player.SELF);
      expect(outcomes.length).toBe(1);
      expect(outcomes[0].targetPosition.horizontalLayer).toBe(0);
      expect(outcomes[0].targetPosition.verticalLayer).toBe(0);
    });

    test("attacks wall first when target panel has castle > 0", () => {
      const panel = PanelRepository.find(pos(0, 0))!;
      PanelRepository.update(new Panel({ ...panel, player: Player.OPPONENT, castle: 3 }));
      const attacker = makePiece({
        id: 1,
        panelPosition: pos(-1, 0),
        targetPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.INFANTRY,
      });
      PiecesRepository.add(attacker);
      const outcomes = PieceService.finalizePlayerMoves(Player.SELF);
      expect(outcomes.length).toBe(1);
      expect(outcomes[0].wallDamageDealt).toBeGreaterThan(0);
      expect(outcomes[0].entered).toBe(false);
    });

    test("an attack that fails to enter still spends a movementPoint, same as a successful move", () => {
      // Rook(def=1) survives Infantry's (5-1)*1=4 damage when given enough HP, so the
      // attacker doesn't enter — but the attack was still attempted.
      const attacker = makePiece({
        id: 1,
        panelPosition: pos(-1, 0),
        targetPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.INFANTRY,
        movementPoints: 1,
      });
      const defender = makePiece({
        id: 2,
        panelPosition: pos(0, 0),
        player: Player.OPPONENT,
        pieceType: PieceType.ROOK,
        hp: 100,
      });
      PiecesRepository.add(attacker);
      PiecesRepository.add(defender);
      const outcomes = PieceService.finalizePlayerMoves(Player.SELF);
      expect(outcomes[0].entered).toBe(false);
      const updatedAttacker = PiecesRepository.getAll().find((p) => p.id === 1)!;
      expect(updatedAttacker.movementPoints).toBe(0);
    });

    test("skips resolving a piece whose movementPoints haven't reached MOVEMENT_HOP_COST, leaving its target pending", () => {
      // Synthetic movement<1 piece (future Heavy-like unit) — resolution must wait for
      // further accrual, not fire immediately just because a target is assigned.
      const slowPiece = makePiece({
        id: 1,
        panelPosition: pos(-2, 0),
        targetPosition: pos(-1, 0),
        player: Player.SELF,
        pieceType: PieceType.INFANTRY,
        movementPoints: 0.5,
      });
      PiecesRepository.add(slowPiece);

      const outcomes = PieceService.finalizePlayerMoves(Player.SELF);

      expect(outcomes).toEqual([]);
      const unchanged = PiecesRepository.getAll().find((p) => p.id === 1)!;
      expect(unchanged.panelPosition.equals(pos(-2, 0))).toBe(true);
      expect(unchanged.targetPosition?.equals(pos(-1, 0))).toBe(true);
      expect(unchanged.movementPoints).toBe(0.5);
    });

    test("resolves a pending move once movementPoints reach MOVEMENT_HOP_COST", () => {
      const readyPiece = makePiece({
        id: 1,
        panelPosition: pos(-2, 0),
        targetPosition: pos(-1, 0),
        player: Player.SELF,
        pieceType: PieceType.INFANTRY,
        movementPoints: 1,
      });
      PiecesRepository.add(readyPiece);

      PieceService.finalizePlayerMoves(Player.SELF);

      const moved = PiecesRepository.getAll().find((p) => p.id === 1)!;
      expect(moved.panelPosition.equals(pos(-1, 0))).toBe(true);
    });

    test("groups multiple attackers targeting the same panel", () => {
      const a1 = makePiece({
        id: 1,
        panelPosition: pos(-1, 0),
        targetPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.INFANTRY,
      });
      const a2 = makePiece({
        id: 2,
        panelPosition: pos(0, 1),
        targetPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.INFANTRY,
      });
      const defender = makePiece({
        id: 3,
        panelPosition: pos(0, 0),
        player: Player.OPPONENT,
        pieceType: PieceType.INFANTRY,
      });
      PiecesRepository.add(a1);
      PiecesRepository.add(a2);
      PiecesRepository.add(defender);
      const outcomes = PieceService.finalizePlayerMoves(Player.SELF);
      // Both attackers target same panel, so only 1 outcome
      expect(outcomes.length).toBe(1);
    });

    test("a movement=1 piece travels one panel per turn toward a distant empty target, keeping targetPosition until arrival", () => {
      const piece = makePiece({
        id: 1,
        panelPosition: pos(-3, 0),
        targetPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.INFANTRY,
        movementPoints: 1,
      });
      PiecesRepository.add(piece);

      // Turn 1: advances one hop, not yet in range (3 hops away originally).
      PieceService.finalizePlayerMoves(Player.SELF);
      let current = PiecesRepository.getAll().find((p) => p.id === 1)!;
      expect(current.panelPosition.equals(pos(-2, 0))).toBe(true);
      expect(current.targetPosition?.equals(pos(0, 0))).toBe(true);
      expect(current.movementPoints).toBe(0);

      // Turn 2: accrues back to 1, advances one more hop — now adjacent, but with no
      // movement points left to also engage/enter this same turn.
      PieceService.accrueMovementForPlayer(Player.SELF);
      PieceService.finalizePlayerMoves(Player.SELF);
      current = PiecesRepository.getAll().find((p) => p.id === 1)!;
      expect(current.panelPosition.equals(pos(-1, 0))).toBe(true);
      expect(current.targetPosition?.equals(pos(0, 0))).toBe(true);
      expect(current.movementPoints).toBe(0);

      // Turn 3: accrues to 1 again; already adjacent, so it enters directly this turn.
      PieceService.accrueMovementForPlayer(Player.SELF);
      PieceService.finalizePlayerMoves(Player.SELF);
      current = PiecesRepository.getAll().find((p) => p.id === 1)!;
      expect(current.panelPosition.equals(pos(0, 0))).toBe(true);
      expect(current.targetPosition).toBeUndefined();
    });

    test("a movement=2 piece reaches a distant defended panel in two turns, engaging that same second turn since a movement point remains", () => {
      const attacker = makePiece({
        id: 1,
        panelPosition: pos(-3, 0),
        targetPosition: pos(1, 0),
        player: Player.SELF,
        pieceType: PieceType.CAVALRY,
        movementPoints: 2,
      });
      const defender = makePiece({
        id: 2,
        panelPosition: pos(1, 0),
        player: Player.OPPONENT,
        pieceType: PieceType.ROOK,
        hp: 100,
      });
      PiecesRepository.add(attacker);
      PiecesRepository.add(defender);

      // Turn 1: covers 2 hops (movement=2), landing 2 hops short of the target — not in range yet.
      PieceService.finalizePlayerMoves(Player.SELF);
      let current = PiecesRepository.getAll().find((p) => p.id === 1)!;
      expect(current.panelPosition.equals(pos(-1, 0))).toBe(true);
      expect(current.targetPosition?.equals(pos(1, 0))).toBe(true);

      // Turn 2: accrues back to 2. Transit stops one panel short of the target (1 hop,
      // spending 1 point), leaving 1 point — enough to engage the defender this same turn.
      PieceService.accrueMovementForPlayer(Player.SELF);
      const outcomes = PieceService.finalizePlayerMoves(Player.SELF);
      expect(outcomes.length).toBe(1);
      current = PiecesRepository.getAll().find((p) => p.id === 1)!;
      expect(current.panelPosition.equals(pos(0, 0))).toBe(true);
      // Defender (hp=100) survives, so the attacker doesn't enter — the attempted attack
      // still consumes its last movement point and clears the (now-resolved) target.
      expect(current.targetPosition).toBeUndefined();
      expect(current.movementPoints).toBe(0);
    });

    test("cannot merge into a friendly panel already at capacity: stays put and cancels the pending order", () => {
      const traveler = makePiece({
        id: 1,
        panelPosition: pos(-3, 0),
        targetPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.INFANTRY,
        movementPoints: 1,
      });
      // (-2,0) is the first hop toward the target and is already at capacity with two
      // different non-mergeable types — the traveler (a third, different type) can't fit.
      const blocker1 = makePiece({
        id: 2,
        panelPosition: pos(-2, 0),
        player: Player.SELF,
        pieceType: PieceType.ROOK,
      });
      const blocker2 = makePiece({
        id: 3,
        panelPosition: pos(-2, 0),
        player: Player.SELF,
        pieceType: PieceType.NOBLE,
      });
      PiecesRepository.add(traveler);
      PiecesRepository.add(blocker1);
      PiecesRepository.add(blocker2);

      PieceService.finalizePlayerMoves(Player.SELF);

      const current = PiecesRepository.getAll().find((p) => p.id === 1)!;
      expect(current.panelPosition.equals(pos(-3, 0))).toBe(true);
      expect(current.targetPosition).toBeUndefined();
      expect(current.movementPoints).toBe(0);
    });

    test("merges into a friendly panel at capacity when its own type is already there, then cancels the pending order", () => {
      const traveler = makePiece({
        id: 1,
        panelPosition: pos(-3, 0),
        targetPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.INFANTRY,
        movementPoints: 1,
      });
      // (-2,0) is at capacity, but one of the two occupants is the same mergeable
      // type as the traveler, so joining doesn't increase the projected slot count.
      const existingInfantry = makePiece({
        id: 2,
        panelPosition: pos(-2, 0),
        player: Player.SELF,
        pieceType: PieceType.INFANTRY,
      });
      const existingRook = makePiece({
        id: 3,
        panelPosition: pos(-2, 0),
        player: Player.SELF,
        pieceType: PieceType.ROOK,
      });
      PiecesRepository.add(traveler);
      PiecesRepository.add(existingInfantry);
      PiecesRepository.add(existingRook);

      PieceService.finalizePlayerMoves(Player.SELF);

      const current = PiecesRepository.getAll().find((p) => p.id === 1)!;
      expect(current.panelPosition.equals(pos(-2, 0))).toBe(true);
      expect(current.targetPosition).toBeUndefined();
      expect(current.movementPoints).toBe(0);
    });

    test("attacks an enemy encountered mid-transit and enters when it wins, cancelling the pending order", () => {
      const traveler = makePiece({
        id: 1,
        panelPosition: pos(-3, 0),
        targetPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.INFANTRY,
        movementPoints: 1,
      });
      // (-2,0) is the first hop toward the target and hosts a weak enemy that dies to
      // Infantry's (5-1)*1=4 damage.
      const defender = makePiece({
        id: 2,
        panelPosition: pos(-2, 0),
        player: Player.OPPONENT,
        pieceType: PieceType.ROOK,
        hp: 4,
      });
      PiecesRepository.add(traveler);
      PiecesRepository.add(defender);

      const outcomes = PieceService.finalizePlayerMoves(Player.SELF);

      expect(outcomes.length).toBe(1);
      expect(outcomes[0].entered).toBe(true);
      const current = PiecesRepository.getAll().find((p) => p.id === 1)!;
      expect(current.panelPosition.equals(pos(-2, 0))).toBe(true);
      expect(current.targetPosition).toBeUndefined();
    });

    test("attacks an enemy encountered mid-transit but stays put when it fails to enter, cancelling the pending order", () => {
      const traveler = makePiece({
        id: 1,
        panelPosition: pos(-3, 0),
        targetPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.INFANTRY,
        movementPoints: 1,
      });
      // A tough enemy (hp=100) survives, so the traveler doesn't enter.
      const defender = makePiece({
        id: 2,
        panelPosition: pos(-2, 0),
        player: Player.OPPONENT,
        pieceType: PieceType.ROOK,
        hp: 100,
      });
      PiecesRepository.add(traveler);
      PiecesRepository.add(defender);

      const outcomes = PieceService.finalizePlayerMoves(Player.SELF);

      expect(outcomes.length).toBe(1);
      expect(outcomes[0].entered).toBe(false);
      const current = PiecesRepository.getAll().find((p) => p.id === 1)!;
      expect(current.panelPosition.equals(pos(-3, 0))).toBe(true);
      expect(current.targetPosition).toBeUndefined();
      expect(current.movementPoints).toBe(0);
    });
  });

  describe("resolveRangedAttacks", () => {
    test("deals damage to a defeatable enemy at distance 2, never moving, and clears the pending attack", () => {
      const archer = makePiece({
        id: 1,
        panelPosition: pos(-1, 0),
        rangedAttackTargetPosition: pos(1, 0),
        player: Player.SELF,
        pieceType: PieceType.ARCHER,
        movementPoints: 1,
      });
      const defender = makePiece({
        id: 2,
        panelPosition: pos(1, 0),
        player: Player.OPPONENT,
        pieceType: PieceType.INFANTRY,
        hp: 100,
      });
      PiecesRepository.add(archer);
      PiecesRepository.add(defender);

      const outcomes = PieceService.resolveRangedAttacks(Player.SELF);

      expect(outcomes.length).toBe(1);
      expect(outcomes[0].entered).toBe(false);
      expect(outcomes[0].wallDamageDealt).toBe(0);

      // Archer (atk 4) vs Infantry (def 1): damage = (4-1)*1 = 3
      const updatedDefender = PiecesRepository.getAll().find((p) => p.id === 2)!;
      expect(updatedDefender.hp).toBe(97);

      const updatedArcher = PiecesRepository.getAll().find((p) => p.id === 1)!;
      expect(updatedArcher.panelPosition.equals(pos(-1, 0))).toBe(true);
      expect(updatedArcher.rangedAttackTargetPosition).toBeUndefined();
      expect(updatedArcher.movementPoints).toBe(0);
    });

    test("groups multiple archers targeting the same panel into one simultaneous combat", () => {
      const archer1 = makePiece({
        id: 1,
        panelPosition: pos(-1, 0),
        rangedAttackTargetPosition: pos(1, 0),
        player: Player.SELF,
        pieceType: PieceType.ARCHER,
        movementPoints: 1,
      });
      const archer2 = makePiece({
        id: 2,
        panelPosition: pos(-1, 1),
        rangedAttackTargetPosition: pos(1, 0),
        player: Player.SELF,
        pieceType: PieceType.ARCHER,
        movementPoints: 1,
      });
      const defender = makePiece({
        id: 3,
        panelPosition: pos(1, 0),
        player: Player.OPPONENT,
        pieceType: PieceType.INFANTRY,
        hp: 100,
      });
      PiecesRepository.add(archer1);
      PiecesRepository.add(archer2);
      PiecesRepository.add(defender);

      const outcomes = PieceService.resolveRangedAttacks(Player.SELF);

      expect(outcomes.length).toBe(1);
    });

    test("does nothing when the target is already empty", () => {
      const archer = makePiece({
        id: 1,
        panelPosition: pos(-1, 0),
        rangedAttackTargetPosition: pos(1, 0),
        player: Player.SELF,
        pieceType: PieceType.ARCHER,
        movementPoints: 1,
      });
      PiecesRepository.add(archer);

      const outcomes = PieceService.resolveRangedAttacks(Player.SELF);

      expect(outcomes).toEqual([]);
      const updated = PiecesRepository.getAll().find((p) => p.id === 1)!;
      expect(updated.rangedAttackTargetPosition).toBeUndefined();
      expect(updated.movementPoints).toBe(0);
    });

    test("skips a piece whose movementPoints haven't reached MOVEMENT_HOP_COST, leaving it pending", () => {
      const archer = makePiece({
        id: 1,
        panelPosition: pos(-1, 0),
        rangedAttackTargetPosition: pos(1, 0),
        player: Player.SELF,
        pieceType: PieceType.ARCHER,
        movementPoints: 0.5,
      });
      const defender = makePiece({
        id: 2,
        panelPosition: pos(1, 0),
        player: Player.OPPONENT,
        pieceType: PieceType.INFANTRY,
      });
      PiecesRepository.add(archer);
      PiecesRepository.add(defender);

      const outcomes = PieceService.resolveRangedAttacks(Player.SELF);

      expect(outcomes).toEqual([]);
      const unchanged = PiecesRepository.getAll().find((p) => p.id === 1)!;
      expect(unchanged.rangedAttackTargetPosition?.equals(pos(1, 0))).toBe(true);
      expect(unchanged.movementPoints).toBe(0.5);
    });
  });

  describe("previewTravelStop", () => {
    test("returns the piece's own position when it has no targetPosition", () => {
      const piece = makePiece({
        panelPosition: pos(1, 1),
        player: Player.SELF,
        pieceType: PieceType.INFANTRY,
      });

      expect(PieceService.previewTravelStop(piece).equals(pos(1, 1))).toBe(true);
    });

    test("returns the target directly when it is adjacent (reached this turn)", () => {
      const piece = makePiece({
        panelPosition: pos(-3, 0),
        targetPosition: pos(-2, 0),
        player: Player.SELF,
        pieceType: PieceType.INFANTRY,
      });

      expect(PieceService.previewTravelStop(piece).equals(pos(-2, 0))).toBe(true);
    });

    test("returns a this-turn stop position short of a distant target, matching finalizePlayerMoves's actual outcome", () => {
      const piece = makePiece({
        id: 1,
        panelPosition: pos(-3, 0),
        targetPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.INFANTRY,
        movementPoints: 1,
      });
      PiecesRepository.add(piece);

      const preview = PieceService.previewTravelStop(piece);
      expect(preview.equals(pos(-2, 0))).toBe(true);

      PieceService.finalizePlayerMoves(Player.SELF);
      const actual = PiecesRepository.getAll().find((p) => p.id === 1)!;
      expect(actual.panelPosition.equals(preview)).toBe(true);
    });

    test("advances further with a larger movement budget", () => {
      const piece = makePiece({
        panelPosition: pos(-3, 0),
        targetPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.CAVALRY,
        movementPoints: 2,
      });

      expect(PieceService.previewTravelStop(piece).equals(pos(-1, 0))).toBe(true);
    });

    test("shows the obstacle position itself as this turn's action target, mirroring finalizePlayerMoves", () => {
      const traveler = makePiece({
        panelPosition: pos(-3, 0),
        targetPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.INFANTRY,
        movementPoints: 1,
      });
      // (-2,0) is the first hop toward the target and is already at capacity.
      PiecesRepository.add(
        makePiece({
          id: 2,
          panelPosition: pos(-2, 0),
          player: Player.SELF,
          pieceType: PieceType.ROOK,
        }),
      );
      PiecesRepository.add(
        makePiece({
          id: 3,
          panelPosition: pos(-2, 0),
          player: Player.SELF,
          pieceType: PieceType.NOBLE,
        }),
      );

      expect(PieceService.previewTravelStop(traveler).equals(pos(-2, 0))).toBe(true);
    });
  });

  describe("mergePiecesAtPosition", () => {
    test("two mergeable Infantry at same position merge into one with summed HP, maxHp, stackCount", () => {
      const k1 = new Piece({
        id: 1,
        panelPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.INFANTRY,
        hp: 8,
        maxHp: 10,
        stackCount: 1,
      });
      const k2 = new Piece({
        id: 2,
        panelPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.INFANTRY,
        hp: 6,
        maxHp: 10,
        stackCount: 1,
      });
      PiecesRepository.add(k1);
      PiecesRepository.add(k2);

      PieceService.mergePiecesAtPosition(pos(0, 0));

      const remaining = PiecesRepository.getPiecesByPosition(pos(0, 0));
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(1); // lowest ID kept
      expect(remaining[0].hp).toBe(14);
      expect(remaining[0].maxHp).toBe(20);
      expect(remaining[0].stackCount).toBe(2);
    });

    test("merged Infantry keeps raw attack power but scales wall attack power by stackCount", () => {
      const k1 = new Piece({
        id: 1,
        panelPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.INFANTRY,
      });
      const k2 = new Piece({
        id: 2,
        panelPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.INFANTRY,
      });
      PiecesRepository.add(k1);
      PiecesRepository.add(k2);

      PieceService.mergePiecesAtPosition(pos(0, 0));

      const merged = PiecesRepository.getPiecesByPosition(pos(0, 0))[0];
      expect(merged.stackCount).toBe(2);
      // AP stays at the raw config value — merge multiplies hit count, not attack power.
      expect(merged.attackPowerAgainstPiece).toBe(5);
      // Wall AP: config(1) * stackCount(2) = 2
      expect(merged.attackPowerAgainstWall).toBe(2);
    });

    test("three Infantry at same position merge into one with combined values", () => {
      [1, 2, 3].forEach((id) =>
        PiecesRepository.add(
          new Piece({
            id,
            panelPosition: pos(0, 0),
            player: Player.SELF,
            pieceType: PieceType.INFANTRY,
            hp: 10,
            maxHp: 10,
            stackCount: 1,
          }),
        ),
      );

      PieceService.mergePiecesAtPosition(pos(0, 0));

      const remaining = PiecesRepository.getPiecesByPosition(pos(0, 0));
      expect(remaining).toHaveLength(1);
      expect(remaining[0].stackCount).toBe(3);
      expect(remaining[0].hp).toBe(30);
      expect(remaining[0].maxHp).toBe(30);
      expect(remaining[0].attackPowerAgainstPiece).toBe(5); // raw config value, unaffected by stackCount
    });

    test("non-mergeable Nobles at same position are NOT merged", () => {
      const b1 = new Piece({
        id: 1,
        panelPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.NOBLE,
      });
      const b2 = new Piece({
        id: 2,
        panelPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.NOBLE,
      });
      PiecesRepository.add(b1);
      PiecesRepository.add(b2);

      PieceService.mergePiecesAtPosition(pos(0, 0));

      expect(PiecesRepository.getPiecesByPosition(pos(0, 0))).toHaveLength(2);
    });

    test("non-mergeable Rooks at same position are NOT merged", () => {
      const r1 = new Piece({
        id: 1,
        panelPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.ROOK,
      });
      const r2 = new Piece({
        id: 2,
        panelPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.ROOK,
      });
      PiecesRepository.add(r1);
      PiecesRepository.add(r2);

      PieceService.mergePiecesAtPosition(pos(0, 0));

      expect(PiecesRepository.getPiecesByPosition(pos(0, 0))).toHaveLength(2);
    });

    test("Infantry of different players at same position are NOT merged", () => {
      const selfInfantry = new Piece({
        id: 1,
        panelPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.INFANTRY,
      });
      const oppInfantry = new Piece({
        id: 2,
        panelPosition: pos(0, 0),
        player: Player.OPPONENT,
        pieceType: PieceType.INFANTRY,
      });
      PiecesRepository.add(selfInfantry);
      PiecesRepository.add(oppInfantry);

      PieceService.mergePiecesAtPosition(pos(0, 0));

      expect(PiecesRepository.getPiecesByPosition(pos(0, 0))).toHaveLength(2);
    });

    test("single Infantry at position is unchanged", () => {
      const k = new Piece({
        id: 1,
        panelPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.INFANTRY,
        hp: 7,
      });
      PiecesRepository.add(k);

      PieceService.mergePiecesAtPosition(pos(0, 0));

      const pieces = PiecesRepository.getPiecesByPosition(pos(0, 0));
      expect(pieces).toHaveLength(1);
      expect(pieces[0].hp).toBe(7);
      expect(pieces[0].stackCount).toBe(1);
    });

    test("lowest ID piece is kept as the merged base", () => {
      const k1 = new Piece({
        id: 10,
        panelPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.INFANTRY,
      });
      const k2 = new Piece({
        id: 3,
        panelPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.INFANTRY,
      });
      const k3 = new Piece({
        id: 7,
        panelPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.INFANTRY,
      });
      PiecesRepository.add(k1);
      PiecesRepository.add(k2);
      PiecesRepository.add(k3);

      PieceService.mergePiecesAtPosition(pos(0, 0));

      const remaining = PiecesRepository.getPiecesByPosition(pos(0, 0));
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(3);
    });
  });

  describe("mergeAllPiecesForPlayer", () => {
    test("merges Infantry at multiple positions for the given player", () => {
      [1, 2].forEach((id) =>
        PiecesRepository.add(
          new Piece({
            id,
            panelPosition: pos(0, 0),
            player: Player.SELF,
            pieceType: PieceType.INFANTRY,
          }),
        ),
      );
      [3, 4].forEach((id) =>
        PiecesRepository.add(
          new Piece({
            id,
            panelPosition: pos(0, 1),
            player: Player.SELF,
            pieceType: PieceType.INFANTRY,
          }),
        ),
      );

      PieceService.mergeAllPiecesForPlayer(Player.SELF);

      expect(PiecesRepository.getPiecesByPosition(pos(0, 0))).toHaveLength(1);
      expect(PiecesRepository.getPiecesByPosition(pos(0, 1))).toHaveLength(1);
    });

    test("does not affect opponent pieces", () => {
      [1, 2].forEach((id) =>
        PiecesRepository.add(
          new Piece({
            id,
            panelPosition: pos(0, 0),
            player: Player.OPPONENT,
            pieceType: PieceType.INFANTRY,
          }),
        ),
      );

      PieceService.mergeAllPiecesForPlayer(Player.SELF);

      expect(PiecesRepository.getPiecesByPosition(pos(0, 0))).toHaveLength(2);
    });
  });
});
