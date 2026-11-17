import { describe, test, expect, beforeEach } from "vitest";
import { MovementRulesService } from "#lib/services/MovementRulesService.ts";
import { GameApi } from "#lib/api/GameApi.ts";
import { PiecesRepository } from "#lib/data/repositories/PieceRepository.ts";
import { PanelRepository } from "#lib/data/repositories/PanelRepository.ts";
import { Piece } from "#lib/domain/entities/Piece.ts";
import { Panel } from "#lib/domain/entities/Panel.ts";
import { PanelPosition } from "#lib/domain/entities/PanelPosition.ts";
import { PieceType } from "#lib/domain/enums/PieceType.ts";
import { Player } from "#lib/domain/enums/Player.ts";

const pos = (h: number, v: number) => new PanelPosition({ horizontalLayer: h, verticalLayer: v });

function addPiece(
  id: number,
  position: PanelPosition,
  player: Player,
  opts: {
    pieceType?: PieceType;
    targetPosition?: PanelPosition;
    transitPosition?: PanelPosition;
    movementPoints?: number;
  } = {},
): Piece {
  const piece = new Piece({
    id,
    panelPosition: position,
    player,
    pieceType: opts.pieceType ?? PieceType.INFANTRY,
    targetPosition: opts.targetPosition,
    transitPosition: opts.transitPosition,
    movementPoints: opts.movementPoints,
  });
  PiecesRepository.add(piece);
  return piece;
}

function setPanel(position: PanelPosition, player: Player, castle: number = 0) {
  const existing = PanelRepository.find(position);
  if (existing) {
    PanelRepository.update(
      new Panel({
        panelPosition: position,
        panelState: existing.panelState,
        player,
        castle,
      }),
    );
  }
}

describe("MovementRulesService", () => {
  beforeEach(() => {
    GameApi.initializeGame({ layer: 5 });
  });

  describe("hasEnemyPresence", () => {
    test("returns true when enemy pieces occupy the position", () => {
      addPiece(100, pos(1, 0), Player.OPPONENT);
      expect(MovementRulesService.hasEnemyPresence(pos(1, 0), Player.SELF)).toBe(true);
    });

    test("returns true when enemy-owned castle exists (no enemy pieces)", () => {
      setPanel(pos(1, 0), Player.OPPONENT, 5);
      expect(MovementRulesService.hasEnemyPresence(pos(1, 0), Player.SELF)).toBe(true);
    });

    test("returns false for panel with only friendly pieces", () => {
      addPiece(100, pos(1, 0), Player.SELF);
      expect(MovementRulesService.hasEnemyPresence(pos(1, 0), Player.SELF)).toBe(false);
    });

    test("returns false for neutral (UNKNOWN) panel with no pieces", () => {
      expect(MovementRulesService.hasEnemyPresence(pos(1, 0), Player.SELF)).toBe(false);
    });
  });

  describe("isTransitObstacle", () => {
    test("returns true when an enemy piece occupies the position", () => {
      addPiece(100, pos(1, 0), Player.OPPONENT);
      expect(MovementRulesService.isTransitObstacle(pos(1, 0), Player.SELF)).toBe(true);
    });

    test("returns true when an enemy-owned castle exists (no enemy pieces)", () => {
      setPanel(pos(1, 0), Player.OPPONENT, 5);
      expect(MovementRulesService.isTransitObstacle(pos(1, 0), Player.SELF)).toBe(true);
    });

    test("returns true when a friendly panel is already at capacity", () => {
      addPiece(100, pos(1, 0), Player.SELF, { pieceType: PieceType.ROOK });
      addPiece(101, pos(1, 0), Player.SELF, { pieceType: PieceType.NOBLE });
      // projected count at (1,0) = 2 >= DEFAULT_MAX_PIECES_PER_PANEL(2)
      expect(MovementRulesService.isTransitObstacle(pos(1, 0), Player.SELF)).toBe(true);
    });

    test("returns false for an empty or under-capacity friendly panel", () => {
      addPiece(100, pos(1, 0), Player.SELF, { pieceType: PieceType.ROOK });
      expect(MovementRulesService.isTransitObstacle(pos(1, 0), Player.SELF)).toBe(false);
      expect(MovementRulesService.isTransitObstacle(pos(2, 0), Player.SELF)).toBe(false);
    });
  });

  describe("projectedFriendlyStackCount", () => {
    test("counts multiple incoming mergeable pieces of the same type as one projected stack", () => {
      addPiece(100, pos(0, 0), Player.SELF, {
        pieceType: PieceType.INFANTRY,
        targetPosition: pos(1, 0),
      });
      addPiece(101, pos(0, 1), Player.SELF, {
        pieceType: PieceType.ROOK,
        targetPosition: pos(1, 0),
      });
      addPiece(102, pos(1, 1), Player.SELF, { pieceType: PieceType.INFANTRY });

      expect(MovementRulesService.projectedFriendlyStackCount(pos(1, 0), Player.SELF)).toBe(2);
    });
  });

  describe("canMoveTo", () => {
    test("allows move to enemy panel regardless of capacity", () => {
      // Fill the target with max friendly pieces, but enemy present → still allowed
      addPiece(100, pos(1, 0), Player.SELF);
      addPiece(101, pos(1, 0), Player.SELF);
      addPiece(200, pos(1, 0), Player.OPPONENT); // enemy presence
      const piece = addPiece(300, pos(0, 0), Player.SELF);
      expect(MovementRulesService.canMoveTo(pos(1, 0), Player.SELF, piece.id)).toBe(true);
    });

    test("allows move to friendly panel when projected count is within capacity", () => {
      addPiece(100, pos(1, 0), Player.SELF); // 1 friendly at target
      const piece = addPiece(200, pos(0, 0), Player.SELF);
      // projected count at (1,0) = 1, + 1 = 2 <= DEFAULT_MAX_PIECES_PER_PANEL(2)
      expect(MovementRulesService.canMoveTo(pos(1, 0), Player.SELF, piece.id)).toBe(true);
    });

    test("blocks move to friendly panel when projected count exceeds capacity", () => {
      addPiece(100, pos(1, 0), Player.SELF, { pieceType: PieceType.ROOK });
      addPiece(101, pos(1, 0), Player.SELF, { pieceType: PieceType.NOBLE });
      const piece = addPiece(200, pos(0, 0), Player.SELF);
      // projected count at (1,0) = 2, + 1 = 3 > DEFAULT_MAX_PIECES_PER_PANEL(2), and no merge target exists
      expect(MovementRulesService.canMoveTo(pos(1, 0), Player.SELF, piece.id)).toBe(false);
    });

    test("allows move to full friendly panel when moving piece can merge with a resident friendly piece", () => {
      addPiece(100, pos(1, 0), Player.SELF, { pieceType: PieceType.INFANTRY });
      addPiece(101, pos(1, 0), Player.SELF, { pieceType: PieceType.ROOK });
      const piece = addPiece(200, pos(0, 0), Player.SELF, { pieceType: PieceType.INFANTRY });

      expect(MovementRulesService.canMoveTo(pos(1, 0), Player.SELF, piece.id)).toBe(true);
    });

    test("allows move when target has one resident piece and two incoming mergeable pieces collapse into one stack", () => {
      addPiece(100, pos(1, 0), Player.SELF, { pieceType: PieceType.ROOK });
      addPiece(101, pos(0, 1), Player.SELF, {
        pieceType: PieceType.INFANTRY,
        targetPosition: pos(1, 0),
      });
      const piece = addPiece(200, pos(0, 0), Player.SELF, { pieceType: PieceType.INFANTRY });

      expect(MovementRulesService.canMoveTo(pos(1, 0), Player.SELF, piece.id)).toBe(true);
    });

    test("allows move when target is empty and two incoming mergeable pieces share one stack with another incoming piece", () => {
      addPiece(100, pos(0, 1), Player.SELF, {
        pieceType: PieceType.INFANTRY,
        targetPosition: pos(1, 0),
      });
      addPiece(101, pos(1, 1), Player.SELF, {
        pieceType: PieceType.ROOK,
        targetPosition: pos(1, 0),
      });
      const piece = addPiece(200, pos(0, 0), Player.SELF, { pieceType: PieceType.INFANTRY });

      expect(MovementRulesService.canMoveTo(pos(1, 0), Player.SELF, piece.id)).toBe(true);
    });

    test("allows stay move on a full panel when mergeable resident pieces collapse into one stack", () => {
      const selectedPiece = addPiece(100, pos(1, 0), Player.SELF, {
        pieceType: PieceType.INFANTRY,
      });
      addPiece(101, pos(1, 0), Player.SELF, { pieceType: PieceType.INFANTRY });
      addPiece(102, pos(1, 0), Player.SELF, { pieceType: PieceType.ROOK });

      expect(MovementRulesService.canMoveTo(pos(1, 0), Player.SELF, selectedPiece.id)).toBe(true);
    });

    test("blocks move to full friendly panel when no resident friendly piece can merge", () => {
      addPiece(100, pos(1, 0), Player.SELF, { pieceType: PieceType.ROOK });
      addPiece(101, pos(1, 0), Player.SELF, { pieceType: PieceType.NOBLE });
      const piece = addPiece(200, pos(0, 0), Player.SELF, { pieceType: PieceType.INFANTRY });

      expect(MovementRulesService.canMoveTo(pos(1, 0), Player.SELF, piece.id)).toBe(false);
    });

    test("piece with 0 attack power cannot move to enemy panel", () => {
      const noble = new Piece({
        id: 1,
        panelPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.NOBLE,
      });
      PiecesRepository.add(noble);
      addPiece(50, pos(1, 0), Player.OPPONENT);
      expect(MovementRulesService.canMoveTo(pos(1, 0), Player.SELF, noble.id)).toBe(false);
    });

    test("piece with attack power > 0 can move to enemy panel", () => {
      const infantry = addPiece(1, pos(0, 0), Player.SELF);
      addPiece(50, pos(1, 0), Player.OPPONENT);
      expect(MovementRulesService.canMoveTo(pos(1, 0), Player.SELF, infantry.id)).toBe(true);
    });

    test("blocks move to enemy panel when a defender's defense exceeds the attacker's raw attack power", () => {
      const attacker = addPiece(1, pos(0, 0), Player.SELF, { pieceType: PieceType.ROOK }); // atk=2
      // No shipped unit type currently has defense > 2, so exercise the gate directly at the
      // MovementRulesService level with a hand-built defender. This is a canary for Phase E,
      // when Heavy (defense=2) and Siege (defense=3) land.
      const highDefenseDefender = new Piece({
        id: 50,
        panelPosition: pos(1, 0),
        player: Player.OPPONENT,
        pieceType: PieceType.NOBLE,
      });
      Object.defineProperty(highDefenseDefender, "defense", { value: 3 });
      expect(MovementRulesService.canDefeatAllDefenders(attacker, [highDefenseDefender])).toBe(
        false,
      );
    });

    test("allows attack when defender's defense equals the attacker's raw attack power (boundary)", () => {
      const attacker = addPiece(1, pos(0, 0), Player.SELF, { pieceType: PieceType.ROOK }); // atk=2
      const defender = addPiece(50, pos(1, 0), Player.OPPONENT, { pieceType: PieceType.ROOK }); // def=1
      expect(MovementRulesService.canDefeatAllDefenders(attacker, [defender])).toBe(true);
      expect(MovementRulesService.canMoveTo(pos(1, 0), Player.SELF, attacker.id)).toBe(true);
    });

    test("merge (stackCount) never affects the defense gate — only the raw config attack power counts", () => {
      const mergedAttacker = new Piece({
        id: 1,
        panelPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.ROOK, // atk=2
        stackCount: 3,
      });
      const highDefenseDefender = new Piece({
        id: 50,
        panelPosition: pos(1, 0),
        player: Player.OPPONENT,
        pieceType: PieceType.NOBLE,
      });
      Object.defineProperty(highDefenseDefender, "defense", { value: 3 });
      expect(
        MovementRulesService.canDefeatAllDefenders(mergedAttacker, [highDefenseDefender]),
      ).toBe(false);
    });

    test("wall-only panel (no defending pieces) is never gated by the defense check", () => {
      const attacker = addPiece(1, pos(0, 0), Player.SELF, { pieceType: PieceType.NOBLE }); // atk=0, but canAttack is false anyway
      setPanel(pos(1, 0), Player.OPPONENT, 5);
      const wallAttacker = addPiece(2, pos(0, 1), Player.SELF, { pieceType: PieceType.ROOK });
      expect(MovementRulesService.canMoveTo(pos(1, 0), Player.SELF, wallAttacker.id)).toBe(true);
      expect(attacker.canAttack).toBe(false); // sanity: unrelated to the wall-only assertion above
    });
  });

  describe("canCancelMove", () => {
    test("allows cancel when returning piece keeps current panel within capacity", () => {
      // piece at (0,0) with target (1,0). current panel (0,0) has 1 other piece.
      addPiece(100, pos(0, 0), Player.SELF);
      const piece = addPiece(200, pos(0, 0), Player.SELF, { targetPosition: pos(1, 0) });
      // projected at (0,0) without piece 200: counts other(100) at (0,0) = 1; +1 = 2 <= 2
      expect(MovementRulesService.canCancelMove(pos(0, 0), Player.SELF, piece.id)).toBe(true);
    });

    test("blocks cancel when returning piece would exceed current panel capacity", () => {
      // 2 pieces already projected at (0,0), plus the cancelling piece would make 3
      addPiece(100, pos(0, 0), Player.SELF, { pieceType: PieceType.ROOK });
      addPiece(101, pos(0, 0), Player.SELF, { pieceType: PieceType.NOBLE });
      const piece = addPiece(200, pos(0, 0), Player.SELF, {
        pieceType: PieceType.INFANTRY,
        targetPosition: pos(1, 0),
      });
      // projected stack count at (0,0) without piece 200 is 2; including it makes 3 > 2
      expect(MovementRulesService.canCancelMove(pos(0, 0), Player.SELF, piece.id)).toBe(false);
    });

    test("allows cancel when returning mergeable piece collapses into an existing stack on a full panel", () => {
      addPiece(100, pos(0, 0), Player.SELF, { pieceType: PieceType.INFANTRY });
      addPiece(101, pos(0, 0), Player.SELF, { pieceType: PieceType.ROOK });
      const piece = addPiece(200, pos(0, 0), Player.SELF, {
        pieceType: PieceType.INFANTRY,
        targetPosition: pos(1, 0),
      });

      expect(MovementRulesService.canCancelMove(pos(0, 0), Player.SELF, piece.id)).toBe(true);
    });
  });

  describe.each([Player.SELF, Player.OPPONENT])("slow pieces (%s)", (player) => {
    const opponent = player === Player.SELF ? Player.OPPONENT : Player.SELF;
    const origin = pos(0, 0);
    const hop = pos(0, 1);
    const beyond = pos(0, 2);

    const findPiece = (id: number) => PiecesRepository.getAll().find((piece) => piece.id === id)!;

    function addHeavy(
      opts: {
        targetPosition?: PanelPosition;
        transitPosition?: PanelPosition;
        movementPoints?: number;
      } = {},
    ): Piece {
      return addPiece(1, origin, player, {
        pieceType: PieceType.HEAVY,
        movementPoints: 0,
        ...opts,
      });
    }

    /** Fills <position> with two non-mergeable pieces of <player>, using ids from <firstId>. */
    function fillPanel(position: PanelPosition, firstId: number): void {
      addPiece(firstId, position, player, { pieceType: PieceType.ROOK });
      addPiece(firstId + 1, position, player, { pieceType: PieceType.NOBLE });
    }

    describe("endOfTurnOccupancy", () => {
      test("a piece without an order takes up its own panel", () => {
        const heavy = addHeavy();
        expect(MovementRulesService.endOfTurnOccupancy(heavy)).toEqual([origin]);
      });

      test("a piece ordered to its own panel takes up its own panel", () => {
        const heavy = addHeavy({ targetPosition: origin });
        expect(MovementRulesService.endOfTurnOccupancy(heavy)).toEqual([origin]);
      });

      test("a piece whose next hop has an enemy takes up its own panel", () => {
        addPiece(10, hop, opponent);
        const heavy = addHeavy({ targetPosition: beyond });
        expect(MovementRulesService.endOfTurnOccupancy(heavy)).toEqual([origin]);
      });

      test("a piece that reaches its next hop this turn takes up only the hop panel", () => {
        const heavy = addHeavy({
          targetPosition: beyond,
          transitPosition: hop,
          movementPoints: 0.5,
        });
        expect(MovementRulesService.endOfTurnOccupancy(heavy)).toEqual([hop]);
      });

      test("a piece that starts its transit this turn takes up its own panel and the hop panel", () => {
        const heavy = addHeavy({ targetPosition: beyond });
        expect(MovementRulesService.endOfTurnOccupancy(heavy)).toEqual([origin, hop]);
      });

      test("a piece that stays in transit this turn takes up its own panel and the hop panel", () => {
        // Progress that does not reach MOVEMENT_HOP_COST even after this turn's advance.
        const heavy = addHeavy({
          targetPosition: beyond,
          transitPosition: hop,
          movementPoints: 0.25,
        });
        expect(MovementRulesService.endOfTurnOccupancy(heavy)).toEqual([origin, hop]);
      });

      test("a piece that hops once per turn takes up its target, or its own panel when attacking", () => {
        const mover = addPiece(2, origin, player, { targetPosition: hop });
        expect(MovementRulesService.endOfTurnOccupancy(mover)).toEqual([hop]);

        addPiece(10, pos(1, 0), opponent);
        const attacker = addPiece(3, origin, player, { targetPosition: pos(1, 0) });
        expect(MovementRulesService.endOfTurnOccupancy(attacker)).toEqual([origin]);
      });
    });

    describe("gradualHop", () => {
      test("is undefined without an order", () => {
        expect(MovementRulesService.gradualHop(addHeavy())).toBeUndefined();
      });

      test("is the own panel when ordered to stay", () => {
        expect(MovementRulesService.gradualHop(addHeavy({ targetPosition: origin }))).toEqual(
          origin,
        );
      });

      test("is the first step toward a distant target", () => {
        const heavy = addHeavy({ targetPosition: beyond });
        expect(MovementRulesService.gradualHop(heavy)?.equals(hop)).toBe(true);
      });

      test("is the panel being moved into while in transit, whatever the final target", () => {
        const heavy = addHeavy({
          targetPosition: pos(1, 0),
          transitPosition: hop,
          movementPoints: 0.5,
        });
        expect(MovementRulesService.gradualHop(heavy)?.equals(hop)).toBe(true);
      });
    });

    describe("completesHopThisTurn", () => {
      test("is false when this turn's progress stays below MOVEMENT_HOP_COST", () => {
        expect(MovementRulesService.completesHopThisTurn(addHeavy({ movementPoints: 0 }))).toBe(
          false,
        );
      });

      test("is true when this turn's progress reaches MOVEMENT_HOP_COST", () => {
        expect(MovementRulesService.completesHopThisTurn(addHeavy({ movementPoints: 0.5 }))).toBe(
          true,
        );
      });
    });

    describe("isOrderLocked", () => {
      test("is true for a slow piece that has started winding up an attack", () => {
        addPiece(10, hop, opponent);
        const heavy = addHeavy({ targetPosition: hop, movementPoints: 0.5 });
        expect(MovementRulesService.isOrderLocked(heavy)).toBe(true);
      });

      test("is false for a slow piece given an order this turn", () => {
        const heavy = addHeavy({ targetPosition: hop, movementPoints: 0 });
        expect(MovementRulesService.isOrderLocked(heavy)).toBe(false);
      });

      test("is false for a slow piece in transit", () => {
        const heavy = addHeavy({ targetPosition: hop, transitPosition: hop, movementPoints: 0.5 });
        expect(MovementRulesService.isOrderLocked(heavy)).toBe(false);
      });

      test("is false for a slow piece without an order", () => {
        expect(MovementRulesService.isOrderLocked(addHeavy({ movementPoints: 0.5 }))).toBe(false);
      });

      test("is false for a piece that hops once per turn", () => {
        const piece = addPiece(2, origin, player, { targetPosition: hop, movementPoints: 1 });
        expect(MovementRulesService.isOrderLocked(piece)).toBe(false);
      });
    });

    describe("withOrder", () => {
      test("sets the target and restarts the progress of a slow piece on its panel", () => {
        const heavy = addHeavy({ targetPosition: hop, movementPoints: 0.5 });
        const ordered = MovementRulesService.withOrder(heavy, beyond);

        expect(ordered.targetPosition?.equals(beyond)).toBe(true);
        expect(ordered.movementPoints).toBe(0);
        expect(heavy.targetPosition?.equals(hop)).toBe(true);
      });

      test("keeps the hop in progress of a slow piece in transit", () => {
        const heavy = addHeavy({ targetPosition: hop, transitPosition: hop, movementPoints: 0.5 });
        const ordered = MovementRulesService.withOrder(heavy, beyond);

        expect(ordered.targetPosition?.equals(beyond)).toBe(true);
        expect(ordered.transitPosition?.equals(hop)).toBe(true);
        expect(ordered.movementPoints).toBe(0.5);
      });

      test("keeps the banked movement points of a piece that hops once per turn", () => {
        const piece = addPiece(2, origin, player, { movementPoints: 1 });
        expect(MovementRulesService.withOrder(piece, hop).movementPoints).toBe(1);
      });
    });

    describe("fitsAtEndOfTurn", () => {
      test("is true when every panel the piece takes up has room", () => {
        const heavy = addHeavy({ targetPosition: beyond });
        expect(MovementRulesService.fitsAtEndOfTurn(heavy, 2)).toBe(true);
      });

      test("is false when the hop panel a slow piece starts moving into is full", () => {
        fillPanel(hop, 10);
        const heavy = addHeavy({ targetPosition: beyond });
        expect(MovementRulesService.fitsAtEndOfTurn(heavy, 2)).toBe(false);
      });

      test("is false when the own panel a slow piece stays on is full", () => {
        fillPanel(origin, 10);
        const heavy = addHeavy({ targetPosition: beyond });
        expect(MovementRulesService.fitsAtEndOfTurn(heavy, 2)).toBe(false);
      });
    });

    describe("canMoveTo", () => {
      test("is false for a piece winding up an attack", () => {
        addPiece(10, hop, opponent);
        addHeavy({ targetPosition: hop, movementPoints: 0.5 });

        expect(MovementRulesService.canMoveTo(origin, player, 1)).toBe(false);
        expect(MovementRulesService.canMoveTo(hop, player, 1)).toBe(false);
      });

      test("an attack is refused when the attacker's own panel has no room for it to stay", () => {
        addPiece(10, hop, opponent);
        const attacker = addPiece(2, origin, player);
        addPiece(3, origin, player, { pieceType: PieceType.ROOK });
        addPiece(4, pos(1, 0), player, { pieceType: PieceType.NOBLE, targetPosition: origin });

        expect(MovementRulesService.canMoveTo(hop, player, attacker.id)).toBe(false);
        // Moving away to a free friendly panel releases the own panel instead.
        expect(MovementRulesService.canMoveTo(pos(-1, 0), player, attacker.id)).toBe(true);
      });

      test("an attack is allowed when the attacker's own panel has room for it to stay", () => {
        addPiece(10, hop, opponent);
        const attacker = addPiece(2, origin, player);

        expect(MovementRulesService.canMoveTo(hop, player, attacker.id)).toBe(true);
      });

      test("a slow piece is refused when the hop it would start this turn has no room", () => {
        fillPanel(hop, 10);
        addHeavy();

        expect(MovementRulesService.canMoveTo(beyond, player, 1)).toBe(false);
      });

      test("a slow piece is allowed when the hop it would start this turn has room", () => {
        addHeavy();

        expect(MovementRulesService.canMoveTo(beyond, player, 1)).toBe(true);
      });
    });

    describe("canCancelMove", () => {
      test("is false for a piece winding up an attack", () => {
        addPiece(10, hop, opponent);
        addHeavy({ targetPosition: hop, movementPoints: 0.5 });

        expect(MovementRulesService.canCancelMove(origin, player, 1)).toBe(false);
      });

      test("is false for a piece in transit already headed only for the panel it is moving into", () => {
        addHeavy({ targetPosition: hop, transitPosition: hop, movementPoints: 0.5 });

        expect(MovementRulesService.canCancelMove(origin, player, 1)).toBe(false);
      });

      test("is true for a piece in transit headed farther than the panel it is moving into", () => {
        // Its own panel being full does not matter: cancelling stops it at the hop panel.
        fillPanel(origin, 10);
        addHeavy({ targetPosition: beyond, transitPosition: hop, movementPoints: 0.5 });

        expect(MovementRulesService.canCancelMove(origin, player, 1)).toBe(true);
      });

      test("is true for a slow piece given an order this turn", () => {
        addHeavy({ targetPosition: hop, movementPoints: 0 });

        expect(MovementRulesService.canCancelMove(origin, player, 1)).toBe(true);
        expect(findPiece(1).targetPosition?.equals(hop)).toBe(true);
      });
    });
  });

  describe("canRangedAttack", () => {
    test("returns false when the target is only adjacent (distance 1)", () => {
      const attacker = addPiece(100, pos(0, 0), Player.SELF, { pieceType: PieceType.ARCHER });
      addPiece(200, pos(1, 0), Player.OPPONENT);
      expect(MovementRulesService.canRangedAttack(attacker.id, pos(1, 0))).toBe(false);
    });

    test("returns true at distance 2 with a defeatable enemy present", () => {
      const attacker = addPiece(100, pos(0, 0), Player.SELF, { pieceType: PieceType.ARCHER });
      addPiece(200, pos(2, 0), Player.OPPONENT);
      expect(MovementRulesService.canRangedAttack(attacker.id, pos(2, 0))).toBe(true);
    });

    test("returns false at distance 2 when no enemy is present", () => {
      const attacker = addPiece(100, pos(0, 0), Player.SELF, { pieceType: PieceType.ARCHER });
      expect(MovementRulesService.canRangedAttack(attacker.id, pos(2, 0))).toBe(false);
    });

    test("returns false for a piece whose attackRange is only 1, even at distance 2", () => {
      const attacker = addPiece(100, pos(0, 0), Player.SELF, { pieceType: PieceType.INFANTRY });
      addPiece(200, pos(2, 0), Player.OPPONENT);
      expect(MovementRulesService.canRangedAttack(attacker.id, pos(2, 0))).toBe(false);
    });

    test("returns false when the attacker piece does not exist", () => {
      expect(MovementRulesService.canRangedAttack(999, pos(2, 0))).toBe(false);
    });

    test("returns false when the target panel has an enemy castle wall, even with a defeatable defender present", () => {
      const attacker = addPiece(100, pos(0, 0), Player.SELF, { pieceType: PieceType.ARCHER });
      addPiece(200, pos(2, 0), Player.OPPONENT);
      setPanel(pos(2, 0), Player.OPPONENT, 5);
      expect(MovementRulesService.canRangedAttack(attacker.id, pos(2, 0))).toBe(false);
    });
  });
});
