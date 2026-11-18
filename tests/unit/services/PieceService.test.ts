import { beforeEach, describe, test, expect } from "vitest";
import { GameApi } from "#lib/api/GameApi.ts";
import { PieceService } from "#lib/services/PieceService.ts";
import { MovementRulesService } from "#lib/services/MovementRulesService.ts";
import { PanelRepository, PiecesRepository } from "#lib/store.svelte.ts";
import {
  type PanelPosition,
  type Piece,
  PieceType,
  Player,
  pos,
  samePos,
  isAdjacent,
  createPiece,
  createPanel,
  pieceConfig,
  wallAttackPower,
} from "#lib/domain/model.ts";
import {
  DEFAULT_MAX_PIECES_PER_PANEL,
  HOME_BASE_INIT_CASTLE,
  PASSIVE_CASTLE_CAP,
  PASSIVE_RESOURCE_CAP,
} from "#lib/domain/config.ts";

const makePiece = (
  overrides: Partial<Piece> & {
    panelPosition: PanelPosition;
    player: Player;
    pieceType: PieceType;
  },
) =>
  createPiece({
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
      expect(samePos(updated.panelPosition, pos(-1, 0))).toBe(true);
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
      expect(samePos(updated.initialPosition, pos(-1, 0))).toBe(true);
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
      expect(samePos(updated.initialPosition, pos(-1, 0))).toBe(true);
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
      expect(samePos(oppUpdated.initialPosition, pos(2, 0))).toBe(true);
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
      PanelRepository.update(createPanel({ ...panel, player: Player.SELF, resource: 0 }));
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
        createPanel({ ...panel, player: Player.SELF, resource: PASSIVE_RESOURCE_CAP }),
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
      PanelRepository.update(createPanel({ ...panel, player: Player.SELF, castle: 0 }));
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
        createPanel({ ...panel, player: Player.SELF, castle: PASSIVE_CASTLE_CAP }),
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
      expect(samePos(moved.panelPosition, pos(-1, 0))).toBe(true);
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
      PanelRepository.update(createPanel({ ...panel, player: Player.OPPONENT, castle: 3 }));
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
      expect(samePos(unchanged.panelPosition, pos(-2, 0))).toBe(true);
      expect(samePos(unchanged.targetPosition, pos(-1, 0))).toBe(true);
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
      expect(samePos(moved.panelPosition, pos(-1, 0))).toBe(true);
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
      expect(samePos(current.panelPosition, pos(-2, 0))).toBe(true);
      expect(samePos(current.targetPosition, pos(0, 0))).toBe(true);
      expect(current.movementPoints).toBe(0);

      // Turn 2: accrues back to 1, advances one more hop — now adjacent, but with no
      // movement points left to also engage/enter this same turn.
      PieceService.accrueMovementForPlayer(Player.SELF);
      PieceService.finalizePlayerMoves(Player.SELF);
      current = PiecesRepository.getAll().find((p) => p.id === 1)!;
      expect(samePos(current.panelPosition, pos(-1, 0))).toBe(true);
      expect(samePos(current.targetPosition, pos(0, 0))).toBe(true);
      expect(current.movementPoints).toBe(0);

      // Turn 3: accrues to 1 again; already adjacent, so it enters directly this turn.
      PieceService.accrueMovementForPlayer(Player.SELF);
      PieceService.finalizePlayerMoves(Player.SELF);
      current = PiecesRepository.getAll().find((p) => p.id === 1)!;
      expect(samePos(current.panelPosition, pos(0, 0))).toBe(true);
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
      expect(samePos(current.panelPosition, pos(-1, 0))).toBe(true);
      expect(samePos(current.targetPosition, pos(1, 0))).toBe(true);

      // Turn 2: accrues back to 2. Transit stops one panel short of the target (1 hop,
      // spending 1 point), leaving 1 point — enough to engage the defender this same turn.
      PieceService.accrueMovementForPlayer(Player.SELF);
      const outcomes = PieceService.finalizePlayerMoves(Player.SELF);
      expect(outcomes.length).toBe(1);
      current = PiecesRepository.getAll().find((p) => p.id === 1)!;
      expect(samePos(current.panelPosition, pos(0, 0))).toBe(true);
      // Defender (hp=100) survives, so the attacker doesn't enter — the attempted attack
      // still consumes its last movement point and clears the (now-resolved) target.
      expect(current.targetPosition).toBeUndefined();
      expect(current.movementPoints).toBe(0);
    });

    test("is blocked by a full friendly panel on its only route: stays put and its order is cancelled", () => {
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
      expect(samePos(current.panelPosition, pos(-3, 0))).toBe(true);
      expect(current.targetPosition).toBeUndefined();
      // It did not move, so it spent no movement points.
      expect(current.movementPoints).toBe(1);
    });

    test("stops on a full friendly panel where it merges with its own type, keeping its order", () => {
      const traveler = makePiece({
        id: 1,
        panelPosition: pos(-3, 0),
        targetPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.INFANTRY,
        movementPoints: 1,
      });
      // (-2,0) is at capacity, but one of the two occupants is the same mergeable
      // type as the traveler, so joining doesn't increase its stack count.
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
      expect(samePos(current.panelPosition, pos(-2, 0))).toBe(true);
      expect(samePos(current.targetPosition, pos(0, 0))).toBe(true);
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
      expect(samePos(current.panelPosition, pos(-2, 0))).toBe(true);
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
      expect(samePos(current.panelPosition, pos(-3, 0))).toBe(true);
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
      expect(samePos(updatedArcher.panelPosition, pos(-1, 0))).toBe(true);
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
      expect(samePos(unchanged.rangedAttackTargetPosition, pos(1, 0))).toBe(true);
      expect(unchanged.movementPoints).toBe(0.5);
    });
  });

  describe("previewEndOfTurnPoint (pieces that hop at most once per turn)", () => {
    const onPanel = (position: PanelPosition) => ({ from: position, to: position, progress: 0 });

    test("returns the piece's own position when it has no targetPosition", () => {
      const piece = makePiece({
        panelPosition: pos(1, 1),
        player: Player.SELF,
        pieceType: PieceType.INFANTRY,
      });
      PiecesRepository.add(piece);

      expect(PieceService.previewEndOfTurnPoint(piece)).toEqual(onPanel(pos(1, 1)));
    });

    test("returns the target directly when it is adjacent (reached this turn)", () => {
      const piece = makePiece({
        panelPosition: pos(-3, 0),
        targetPosition: pos(-2, 0),
        player: Player.SELF,
        pieceType: PieceType.INFANTRY,
      });
      PiecesRepository.add(piece);

      expect(PieceService.previewEndOfTurnPoint(piece)).toEqual(onPanel(pos(-2, 0)));
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

      const preview = PieceService.previewEndOfTurnPoint(piece);
      expect(preview).toEqual(onPanel(pos(-2, 0)));

      PieceService.finalizePlayerMoves(Player.SELF);
      const actual = PiecesRepository.getAll().find((p) => p.id === 1)!;
      expect(samePos(actual.panelPosition, preview.to)).toBe(true);
    });

    test("advances further with a larger movement budget", () => {
      const piece = makePiece({
        panelPosition: pos(-3, 0),
        targetPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.CAVALRY,
        movementPoints: 2,
      });
      PiecesRepository.add(piece);

      expect(PieceService.previewEndOfTurnPoint(piece)).toEqual(onPanel(pos(-1, 0)));
    });

    test("stays on its own panel when a full friendly panel blocks its only route", () => {
      const traveler = makePiece({
        panelPosition: pos(-3, 0),
        targetPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.INFANTRY,
        movementPoints: 1,
      });
      PiecesRepository.add(traveler);
      // (-2,0) is the only first hop toward the target and is already at capacity.
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

      expect(PieceService.previewEndOfTurnPoint(traveler)).toEqual(onPanel(pos(-3, 0)));
    });
  });

  describe("mergePiecesAtPosition", () => {
    test("two mergeable Infantry at same position merge into one with summed HP, maxHp, stackCount", () => {
      const k1 = createPiece({
        id: 1,
        panelPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.INFANTRY,
        hp: 8,
        maxHp: 10,
        stackCount: 1,
      });
      const k2 = createPiece({
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
      const k1 = createPiece({
        id: 1,
        panelPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.INFANTRY,
      });
      const k2 = createPiece({
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
      expect(pieceConfig(merged.pieceType).attackPowerAgainstPiece).toBe(5);
      // Wall AP: config(1) * stackCount(2) = 2
      expect(wallAttackPower(merged)).toBe(2);
    });

    test("three Infantry at same position merge into one with combined values", () => {
      [1, 2, 3].forEach((id) =>
        PiecesRepository.add(
          createPiece({
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
      expect(pieceConfig(remaining[0].pieceType).attackPowerAgainstPiece).toBe(5); // raw config value, unaffected by stackCount
    });

    test("non-mergeable Nobles at same position are NOT merged", () => {
      const b1 = createPiece({
        id: 1,
        panelPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.NOBLE,
      });
      const b2 = createPiece({
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
      const r1 = createPiece({
        id: 1,
        panelPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.ROOK,
      });
      const r2 = createPiece({
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
      const selfInfantry = createPiece({
        id: 1,
        panelPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.INFANTRY,
      });
      const oppInfantry = createPiece({
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
      const k = createPiece({
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
      const k1 = createPiece({
        id: 10,
        panelPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.INFANTRY,
      });
      const k2 = createPiece({
        id: 3,
        panelPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.INFANTRY,
      });
      const k3 = createPiece({
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
          createPiece({
            id,
            panelPosition: pos(0, 0),
            player: Player.SELF,
            pieceType: PieceType.INFANTRY,
          }),
        ),
      );
      [3, 4].forEach((id) =>
        PiecesRepository.add(
          createPiece({
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
          createPiece({
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

  describe.each([Player.SELF, Player.OPPONENT])("slow pieces (%s)", (player) => {
    const opponent = player === Player.SELF ? Player.OPPONENT : Player.SELF;
    const origin = pos(0, 0);
    const hop = pos(0, 1);
    const beyond = pos(0, 2);
    const maxPieces = DEFAULT_MAX_PIECES_PER_PANEL;

    const findPiece = (id: number) => PiecesRepository.getAll().find((piece) => piece.id === id);

    function addHeavy(overrides: Partial<Piece> = {}, id: number = 1): Piece {
      const heavy = makePiece({
        id,
        panelPosition: origin,
        player,
        pieceType: PieceType.HEAVY,
        movementPoints: 0,
        ...overrides,
      });
      PiecesRepository.add(heavy);
      return heavy;
    }

    function addEnemy(id: number, pieceType: PieceType, at: PanelPosition): void {
      PiecesRepository.add(makePiece({ id, panelPosition: at, player: opponent, pieceType }));
    }

    /** Fills <position> with two non-mergeable pieces of the slow piece's owner. */
    function fillPanel(position: PanelPosition, firstId: number): void {
      PiecesRepository.add(
        makePiece({ id: firstId, panelPosition: position, player, pieceType: PieceType.ROOK }),
      );
      PiecesRepository.add(
        makePiece({ id: firstId + 1, panelPosition: position, player, pieceType: PieceType.NOBLE }),
      );
    }

    const stepOf = (piece: Piece) =>
      MovementRulesService.planEndOfTurn(player, maxPieces).get(piece.id)!.step;

    describe("planEndOfTurn steps", () => {
      test("idle: no order", () => {
        expect(stepOf(addHeavy())).toEqual({ kind: "idle" });
      });

      test("stay: ordered to its own panel", () => {
        const heavy = addHeavy({ targetPosition: origin });
        expect(stepOf(heavy)).toEqual({ kind: "stay" });
      });

      test("windUp: the next hop has an enemy and the attack is not ready yet", () => {
        addEnemy(10, PieceType.NOBLE, hop);
        const heavy = addHeavy({ targetPosition: hop });
        expect(stepOf(heavy)).toEqual({ kind: "windUp", target: hop });
      });

      test("startTransit: leaves for a free next hop", () => {
        const heavy = addHeavy({ targetPosition: beyond });
        expect(stepOf(heavy)).toEqual({ kind: "startTransit", hop });
      });

      test("continueTransit: in transit and the hop is not complete this turn", () => {
        const heavy = addHeavy({
          targetPosition: beyond,
          transitPosition: hop,
          movementPoints: 0.25,
        });
        expect(stepOf(heavy)).toEqual({ kind: "continueTransit" });
      });

      test("blocked: the next hop has no room", () => {
        fillPanel(hop, 10);
        const heavy = addHeavy({ targetPosition: beyond });
        expect(stepOf(heavy)).toEqual({ kind: "blocked", path: [] });
      });

      test("enter: the hop completes this turn into a panel without enemies", () => {
        const heavy = addHeavy({
          targetPosition: beyond,
          transitPosition: hop,
          movementPoints: 0.5,
        });
        expect(stepOf(heavy)).toEqual({ kind: "enter", path: [hop] });
      });

      test("attack: the attack or hop completes this turn into a panel with an enemy", () => {
        addEnemy(10, PieceType.NOBLE, hop);
        const heavy = addHeavy({ targetPosition: hop, movementPoints: 0.5 });
        expect(stepOf(heavy)).toEqual({ kind: "attack", path: [], target: hop });
      });
    });

    describe("finalizePlayerMoves", () => {
      test("a slow piece leaving for the next hop goes into transit", () => {
        addHeavy({ targetPosition: beyond });

        PieceService.finalizePlayerMoves(player);

        const heavy = findPiece(1)!;
        expect(samePos(heavy.panelPosition, origin)).toBe(true);
        expect(samePos(heavy.transitPosition, hop)).toBe(true);
        expect(samePos(heavy.targetPosition, beyond)).toBe(true);
        expect(heavy.movementPoints).toBe(0.5);
      });

      test("a slow piece in transit keeps moving while the hop is not complete", () => {
        addHeavy({ targetPosition: beyond, transitPosition: hop, movementPoints: 0.25 });

        PieceService.finalizePlayerMoves(player);

        const heavy = findPiece(1)!;
        expect(samePos(heavy.panelPosition, origin)).toBe(true);
        expect(samePos(heavy.transitPosition, hop)).toBe(true);
        expect(heavy.movementPoints).toBe(0.75);
      });

      test("a slow piece arrives at its final destination", () => {
        addHeavy({ targetPosition: hop, transitPosition: hop, movementPoints: 0.5 });

        PieceService.finalizePlayerMoves(player);

        const heavy = findPiece(1)!;
        expect(samePos(heavy.panelPosition, hop)).toBe(true);
        expect(heavy.transitPosition).toBeUndefined();
        expect(heavy.targetPosition).toBeUndefined();
      });

      test("a slow piece arriving at an intermediate panel keeps its order", () => {
        addHeavy({ targetPosition: beyond, transitPosition: hop, movementPoints: 0.5 });

        PieceService.finalizePlayerMoves(player);

        const heavy = findPiece(1)!;
        expect(samePos(heavy.panelPosition, hop)).toBe(true);
        expect(samePos(heavy.initialPosition, hop)).toBe(true);
        expect(heavy.transitPosition).toBeUndefined();
        expect(samePos(heavy.targetPosition, beyond)).toBe(true);
        expect(heavy.movementPoints).toBe(0);
      });

      test("a slow piece whose hop the enemy entered attacks on arrival and enters when it wins", () => {
        addEnemy(10, PieceType.NOBLE, hop);
        addHeavy({ targetPosition: hop, transitPosition: hop, movementPoints: 0.5 });

        PieceService.finalizePlayerMoves(player);

        expect(findPiece(10)).toBeUndefined();
        const heavy = findPiece(1)!;
        expect(samePos(heavy.panelPosition, hop)).toBe(true);
        expect(heavy.transitPosition).toBeUndefined();
      });

      test("a slow piece whose hop the enemy entered returns to its panel and drops its order when it loses", () => {
        addEnemy(10, PieceType.INFANTRY, hop);
        addHeavy({ targetPosition: beyond, transitPosition: hop, movementPoints: 0.5 });

        PieceService.finalizePlayerMoves(player);

        expect(findPiece(10)).toBeDefined();
        const heavy = findPiece(1)!;
        expect(samePos(heavy.panelPosition, origin)).toBe(true);
        expect(heavy.transitPosition).toBeUndefined();
        expect(heavy.targetPosition).toBeUndefined();
        expect(heavy.hp).toBeLessThan(heavy.maxHp);
      });

      test("a slow piece winds an attack up for a turn, then attacks", () => {
        addEnemy(10, PieceType.NOBLE, hop);
        addHeavy({ targetPosition: hop });

        PieceService.finalizePlayerMoves(player);
        const windingUp = findPiece(1)!;
        expect(samePos(windingUp.panelPosition, origin)).toBe(true);
        expect(windingUp.transitPosition).toBeUndefined();
        expect(samePos(windingUp.targetPosition, hop)).toBe(true);
        expect(windingUp.movementPoints).toBe(0.5);
        expect(findPiece(10)).toBeDefined();

        PieceService.finalizePlayerMoves(player);
        expect(findPiece(10)).toBeUndefined();
        expect(samePos(findPiece(1)!.panelPosition, hop)).toBe(true);
      });

      test("a slow piece whose next hop has no room drops its order", () => {
        fillPanel(hop, 10);
        addHeavy({ targetPosition: beyond });

        PieceService.finalizePlayerMoves(player);

        const heavy = findPiece(1)!;
        expect(samePos(heavy.panelPosition, origin)).toBe(true);
        expect(heavy.transitPosition).toBeUndefined();
        expect(heavy.targetPosition).toBeUndefined();
        expect(heavy.movementPoints).toBe(0);
      });
    });

    test("mergePiecesAtPosition leaves a piece in transit out of the merge", () => {
      addHeavy({ targetPosition: hop, transitPosition: hop, movementPoints: 0.5 }, 1);
      addHeavy({}, 2);

      PieceService.mergePiecesAtPosition(origin);

      expect(findPiece(1)?.stackCount).toBe(1);
      expect(findPiece(2)?.stackCount).toBe(1);
    });

    test("accrueMovementForPlayer leaves the movement points of a slow piece unchanged", () => {
      addHeavy({ targetPosition: hop, movementPoints: 0.5 }, 1);
      PiecesRepository.add(
        makePiece({
          id: 2,
          panelPosition: pos(1, 0),
          player,
          pieceType: PieceType.INFANTRY,
          movementPoints: 0,
        }),
      );

      PieceService.accrueMovementForPlayer(player);

      expect(findPiece(1)!.movementPoints).toBe(0.5);
      expect(findPiece(2)!.movementPoints).toBe(1);
    });

    describe("currentBoardPoint", () => {
      test("is on the panel for a piece not in transit", () => {
        expect(PieceService.currentBoardPoint(addHeavy())).toEqual({
          from: origin,
          to: origin,
          progress: 0,
        });
      });

      test("is part of the way to the hop panel for a piece in transit", () => {
        const heavy = addHeavy({ targetPosition: hop, transitPosition: hop, movementPoints: 0.5 });
        expect(PieceService.currentBoardPoint(heavy)).toEqual({
          from: origin,
          to: hop,
          progress: 0.5,
        });
      });
    });

    describe("previewEndOfTurnPoint", () => {
      test("is on the own panel for a slow piece without an order", () => {
        expect(PieceService.previewEndOfTurnPoint(addHeavy())).toEqual({
          from: origin,
          to: origin,
          progress: 0,
        });
      });

      test("is part of the way to the hop panel for a slow piece going into transit", () => {
        const heavy = addHeavy({ targetPosition: beyond });
        expect(PieceService.previewEndOfTurnPoint(heavy)).toEqual({
          from: origin,
          to: hop,
          progress: 0.5,
        });
      });

      test("is on the hop panel for a slow piece completing its hop", () => {
        const heavy = addHeavy({
          targetPosition: beyond,
          transitPosition: hop,
          movementPoints: 0.5,
        });
        expect(PieceService.previewEndOfTurnPoint(heavy)).toEqual({
          from: hop,
          to: hop,
          progress: 0,
        });
      });

      test("is on the panel the travel stops at for a piece that hops once per turn", () => {
        const infantry = makePiece({
          id: 2,
          panelPosition: origin,
          player,
          pieceType: PieceType.INFANTRY,
          targetPosition: hop,
          movementPoints: 1,
        });
        PiecesRepository.add(infantry);
        expect(PieceService.previewEndOfTurnPoint(infantry)).toEqual({
          from: hop,
          to: hop,
          progress: 0,
        });
      });
    });
  });

  describe.each([Player.SELF, Player.OPPONENT])(
    "finalizePlayerMoves: entering a captured panel in order sequence (%s)",
    (player) => {
      const opponent = player === Player.SELF ? Player.OPPONENT : Player.SELF;
      // Has six neighbors on the layer-4 board, enough attackers to exceed the capacity.
      const target = pos(0, 1);

      const findPiece = (id: number) => PiecesRepository.getAll().find((piece) => piece.id === id)!;
      const neighborsOf = (position: PanelPosition) =>
        PanelRepository.getAll()
          .map((panel) => panel.panelPosition)
          .filter((candidate) => isAdjacent(candidate, position));

      function addAttacker(
        id: number,
        pieceType: PieceType,
        at: PanelPosition,
        orderSequence: number | undefined,
        overrides: Partial<Piece> = {},
      ): void {
        PiecesRepository.add(
          makePiece({
            id,
            panelPosition: at,
            targetPosition: target,
            player,
            pieceType,
            orderSequence,
            ...overrides,
          }),
        );
      }

      /** An enemy that dies to any attack here and never strikes back. */
      function addEnemyNoble(id: number, at: PanelPosition): void {
        PiecesRepository.add(
          makePiece({ id, panelPosition: at, player: opponent, pieceType: PieceType.NOBLE }),
        );
      }

      function expectStayedAfterFailedAttack(id: number, origin: PanelPosition): void {
        const piece = findPiece(id);
        expect(samePos(piece.panelPosition, origin)).toBe(true);
        expect(piece.targetPosition).toBeUndefined();
        expect(piece.movementPoints).toBe(0);
      }

      test("non-mergeable attackers beyond the capacity stay at their origin after winning", () => {
        const [n1, n2, n3] = neighborsOf(target);
        addEnemyNoble(10, target);
        addAttacker(1, PieceType.ROOK, n1, 1);
        addAttacker(2, PieceType.ROOK, n2, 2);
        addAttacker(3, PieceType.ROOK, n3, 3);

        const outcomes = PieceService.finalizePlayerMoves(player);

        expect(outcomes).toHaveLength(1);
        expect(outcomes[0].entered).toBe(true);
        expect(samePos(findPiece(1).panelPosition, target)).toBe(true);
        expect(samePos(findPiece(2).panelPosition, target)).toBe(true);
        expectStayedAfterFailedAttack(3, n3);
      });

      test("the order sequence, not the piece ID, decides which attackers enter", () => {
        const [n1, n2, n3] = neighborsOf(target);
        addEnemyNoble(10, target);
        addAttacker(1, PieceType.ROOK, n1, 3);
        addAttacker(2, PieceType.ROOK, n2, 2);
        addAttacker(3, PieceType.ROOK, n3, 1);

        PieceService.finalizePlayerMoves(player);

        expect(samePos(findPiece(3).panelPosition, target)).toBe(true);
        expect(samePos(findPiece(2).panelPosition, target)).toBe(true);
        expectStayedAfterFailedAttack(1, n1);
      });

      test("a later attacker that merges with one that entered still enters after one that did not fit", () => {
        const [n1, n2, n3, n4] = neighborsOf(target);
        addEnemyNoble(10, target);
        addAttacker(1, PieceType.INFANTRY, n1, 1);
        addAttacker(2, PieceType.CAVALRY, n2, 2);
        addAttacker(3, PieceType.ROOK, n3, 3);
        addAttacker(4, PieceType.INFANTRY, n4, 4);

        PieceService.finalizePlayerMoves(player);

        expect(samePos(findPiece(1).panelPosition, target)).toBe(true);
        expect(samePos(findPiece(2).panelPosition, target)).toBe(true);
        expect(samePos(findPiece(4).panelPosition, target)).toBe(true);
        expectStayedAfterFailedAttack(3, n3);
      });

      test("adjacent attackers and a piece stopped by the same panel on its way fight once and enter in order sequence", () => {
        const obstacle = pos(-2, 0);
        const travelerOrigin = pos(-3, 0);
        const [n1, n2] = neighborsOf(obstacle).filter(
          (candidate) => !samePos(candidate, travelerOrigin),
        );
        addEnemyNoble(10, obstacle);
        addAttacker(1, PieceType.ROOK, n1, 2, { targetPosition: obstacle });
        addAttacker(2, PieceType.ROOK, n2, 3, { targetPosition: obstacle });
        // On its way to (0,0), first stopped by the enemy at (-2,0).
        addAttacker(3, PieceType.ROOK, travelerOrigin, 1);

        const outcomes = PieceService.finalizePlayerMoves(player);

        expect(outcomes).toHaveLength(1);
        expect(samePos(findPiece(3).panelPosition, obstacle)).toBe(true);
        expect(findPiece(3).targetPosition).toBeUndefined();
        expect(samePos(findPiece(1).panelPosition, obstacle)).toBe(true);
        expectStayedAfterFailedAttack(2, n2);
      });

      test.each([
        { heavySequence: 1, entering: [1, 2], staying: 3 },
        { heavySequence: 3, entering: [2, 3], staying: 1 },
      ])(
        "a slow piece completing its attack enters in order sequence ($heavySequence)",
        ({ heavySequence, entering, staying }) => {
          const neighbors = neighborsOf(target);
          addEnemyNoble(10, target);
          addAttacker(1, PieceType.HEAVY, neighbors[0], heavySequence, { movementPoints: 0.5 });
          const rookSequences = heavySequence === 1 ? [2, 3] : [1, 2];
          addAttacker(2, PieceType.ROOK, neighbors[1], rookSequences[0]);
          addAttacker(3, PieceType.ROOK, neighbors[2], rookSequences[1]);

          const outcomes = PieceService.finalizePlayerMoves(player);

          expect(outcomes).toHaveLength(1);
          for (const id of entering) {
            expect(samePos(findPiece(id).panelPosition, target)).toBe(true);
          }
          const stayed = findPiece(staying);
          expect(samePos(stayed.panelPosition, neighbors[staying - 1])).toBe(true);
          expect(stayed.targetPosition).toBeUndefined();
          expect(stayed.transitPosition).toBeUndefined();
        },
      );

      test.each([
        { label: "the panel being left first", leavingFirst: true },
        { label: "the panel being entered first", leavingFirst: false },
      ])(
        "a plain move into a panel another piece is leaving is never blocked ($label)",
        ({ leavingFirst }) => {
          // P holds A and B; A leaves for Q while C moves into P.
          const panelP = target;
          const [panelQ, panelR] = neighborsOf(panelP);
          const leaving = makePiece({
            id: 1,
            panelPosition: panelP,
            targetPosition: panelQ,
            player,
            pieceType: PieceType.ROOK,
          });
          const staying = makePiece({
            id: 2,
            panelPosition: panelP,
            player,
            pieceType: PieceType.ROOK,
          });
          const entering = makePiece({
            id: 3,
            panelPosition: panelR,
            targetPosition: panelP,
            player,
            pieceType: PieceType.ROOK,
          });
          const order = leavingFirst ? [leaving, staying, entering] : [entering, leaving, staying];
          for (const piece of order) PiecesRepository.add(piece);

          PieceService.finalizePlayerMoves(player);

          expect(samePos(findPiece(1).panelPosition, panelQ)).toBe(true);
          expect(samePos(findPiece(3).panelPosition, panelP)).toBe(true);
          expect(findPiece(3).targetPosition).toBeUndefined();
        },
      );
    },
  );

  describe.each([Player.SELF, Player.OPPONENT])(
    "moves along shortest routes to distant targets (%s)",
    (player) => {
      const opponent = player === Player.SELF ? Player.OPPONENT : Player.SELF;
      // (-1,0) reaches (1,0) in two hops, through (0,0) (the route of findShortestPath) or
      // (0,1). The three of (-1,0), (0,0) and (0,1) are adjacent to each other.
      const origin = pos(-1, 0);
      const onRoute = pos(0, 0);
      const detour = pos(0, 1);
      const target = pos(1, 0);
      const onPanel = (position: PanelPosition) => ({ from: position, to: position, progress: 0 });

      const findPiece = (id: number) => PiecesRepository.getAll().find((piece) => piece.id === id)!;

      function addPiece(id: number, at: PanelPosition, overrides: Partial<Piece> = {}): Piece {
        const piece = makePiece({
          id,
          panelPosition: at,
          player,
          pieceType: PieceType.INFANTRY,
          ...overrides,
        });
        PiecesRepository.add(piece);
        return piece;
      }

      /** Fills <position> with two non-mergeable pieces of the player without orders. */
      function fillPanel(position: PanelPosition, firstId: number): void {
        addPiece(firstId, position, { pieceType: PieceType.ROOK });
        addPiece(firstId + 1, position, { pieceType: PieceType.NOBLE });
      }

      describe("finalizePlayerMoves", () => {
        test("goes around a panel without room and keeps its order", () => {
          fillPanel(onRoute, 10);
          addPiece(1, origin, { targetPosition: target, movementPoints: 1 });

          PieceService.finalizePlayerMoves(player);

          const moved = findPiece(1);
          expect(moved.panelPosition).toEqual(detour);
          expect(moved.targetPosition).toEqual(target);
          expect(moved.movementPoints).toBe(0);
        });

        test("walks as far as it can when every route is closed, losing its order and only the points it used", () => {
          fillPanel(pos(1, 0), 10);
          fillPanel(pos(1, 1), 20);
          addPiece(1, origin, {
            pieceType: PieceType.CAVALRY,
            targetPosition: pos(2, 0),
            movementPoints: 2,
          });

          PieceService.finalizePlayerMoves(player);

          const moved = findPiece(1);
          expect(moved.panelPosition).toEqual(onRoute);
          expect(moved.targetPosition).toBeUndefined();
          expect(moved.movementPoints).toBe(1);
        });

        test("attacks an enemy panel on its route and loses its order", () => {
          PiecesRepository.add(
            makePiece({
              id: 20,
              panelPosition: onRoute,
              player: opponent,
              pieceType: PieceType.NOBLE,
              hp: 1,
            }),
          );
          addPiece(1, origin, { targetPosition: target, movementPoints: 1 });

          const outcomes = PieceService.finalizePlayerMoves(player);

          expect(outcomes.map((outcome) => outcome.targetPosition)).toEqual([
            { horizontalLayer: onRoute.horizontalLayer, verticalLayer: onRoute.verticalLayer },
          ]);
          expect(outcomes[0].destroyedPieceIds).toContain(20);
          const attacker = findPiece(1);
          expect(attacker.panelPosition).toEqual(onRoute);
          expect(attacker.targetPosition).toBeUndefined();
        });

        test("stays and loses its order when its target has no room", () => {
          fillPanel(onRoute, 10);
          addPiece(1, origin, { targetPosition: onRoute, movementPoints: 1 });

          PieceService.finalizePlayerMoves(player);

          const piece = findPiece(1);
          expect(piece.panelPosition).toEqual(origin);
          expect(piece.targetPosition).toBeUndefined();
        });

        test("pieces trading places in a cycle all move", () => {
          const panels = [origin, onRoute, detour];
          panels.forEach((position, i) => {
            addPiece(i + 1, position, {
              pieceType: PieceType.NOBLE,
              targetPosition: panels[(i + 1) % panels.length],
              orderSequence: i + 1,
            });
            addPiece(i + 10, position, { pieceType: PieceType.ROOK });
          });

          PieceService.finalizePlayerMoves(player);

          panels.forEach((position, i) => {
            expect(findPiece(i + 1).panelPosition).toEqual(panels[(i + 1) % panels.length]);
            expect(findPiece(i + 10).panelPosition).toEqual(position);
            expect(PiecesRepository.getPiecesByPosition(position)).toHaveLength(2);
          });
        });
      });

      describe("previewEndOfTurnPoint", () => {
        test("shows the panel of the other shortest route it goes around through", () => {
          fillPanel(onRoute, 10);
          const piece = addPiece(1, origin, { targetPosition: target, movementPoints: 1 });

          expect(PieceService.previewEndOfTurnPoint(piece)).toEqual(onPanel(detour));
        });

        test("shows where a blocked piece stops", () => {
          fillPanel(pos(1, 0), 10);
          fillPanel(pos(1, 1), 20);
          const piece = addPiece(1, origin, {
            pieceType: PieceType.CAVALRY,
            targetPosition: pos(2, 0),
            movementPoints: 2,
          });

          expect(PieceService.previewEndOfTurnPoint(piece)).toEqual(onPanel(onRoute));
        });
      });
    },
  );
});
