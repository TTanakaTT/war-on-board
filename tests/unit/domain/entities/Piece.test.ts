import { describe, test, expect } from "vitest";
import { Piece } from "$lib/domain/entities/Piece";
import { PanelPosition } from "$lib/domain/entities/PanelPosition";
import { PieceType } from "$lib/domain/enums/PieceType";
import { Player } from "$lib/domain/enums/Player";

const pos = (h: number, v: number) => new PanelPosition({ horizontalLayer: h, verticalLayer: v });

describe("Piece", () => {
  describe("constructor", () => {
    test("creates piece with all properties specified", () => {
      const piece = new Piece({
        id: 5,
        panelPosition: pos(1, 2),
        initialPosition: pos(0, 0),
        targetPosition: pos(2, 0),
        player: Player.SELF,
        pieceType: PieceType.KNIGHT,
        hp: 7,
      });
      expect(piece.id).toBe(5);
      expect(piece.panelPosition.horizontalLayer).toBe(1);
      expect(piece.initialPosition.horizontalLayer).toBe(0);
      expect(piece.targetPosition?.horizontalLayer).toBe(2);
      expect(piece.player).toBe(Player.SELF);
      expect(piece.pieceType).toBe(PieceType.KNIGHT);
      expect(piece.hp).toBe(7);
    });

    test("defaults id to 0 when omitted", () => {
      const piece = new Piece({
        panelPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.KNIGHT,
      });
      expect(piece.id).toBe(0);
    });

    test("defaults initialPosition to panelPosition when omitted", () => {
      const piece = new Piece({
        panelPosition: pos(1, 2),
        player: Player.SELF,
        pieceType: PieceType.KNIGHT,
      });
      expect(piece.initialPosition.equals(pos(1, 2))).toBe(true);
    });

    test("defaults targetPosition to undefined when omitted", () => {
      const piece = new Piece({
        panelPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.KNIGHT,
      });
      expect(piece.targetPosition).toBeUndefined();
    });

    test("defaults hp to pieceType maxHp when omitted", () => {
      const knight = new Piece({
        panelPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.KNIGHT,
      });
      expect(knight.hp).toBe(PieceType.KNIGHT.config.maxHp);

      const rook = new Piece({
        panelPosition: pos(0, 0),
        player: Player.SELF,
        pieceType: PieceType.ROOK,
      });
      expect(rook.hp).toBe(PieceType.ROOK.config.maxHp);
    });
  });

  describe("equals", () => {
    test("returns true when panelPosition, player, and pieceType match", () => {
      const a = new Piece({
        id: 1,
        panelPosition: pos(1, 2),
        player: Player.SELF,
        pieceType: PieceType.KNIGHT,
      });
      const b = new Piece({
        id: 2,
        panelPosition: pos(1, 2),
        player: Player.SELF,
        pieceType: PieceType.KNIGHT,
      });
      expect(a.equals(b)).toBe(true);
    });

    test("returns false when panelPosition differs", () => {
      const a = new Piece({
        panelPosition: pos(1, 2),
        player: Player.SELF,
        pieceType: PieceType.KNIGHT,
      });
      const b = new Piece({
        panelPosition: pos(2, 2),
        player: Player.SELF,
        pieceType: PieceType.KNIGHT,
      });
      expect(a.equals(b)).toBe(false);
    });

    test("returns false when player differs", () => {
      const a = new Piece({
        panelPosition: pos(1, 2),
        player: Player.SELF,
        pieceType: PieceType.KNIGHT,
      });
      const b = new Piece({
        panelPosition: pos(1, 2),
        player: Player.OPPONENT,
        pieceType: PieceType.KNIGHT,
      });
      expect(a.equals(b)).toBe(false);
    });

    test("returns false when pieceType differs", () => {
      const a = new Piece({
        panelPosition: pos(1, 2),
        player: Player.SELF,
        pieceType: PieceType.KNIGHT,
      });
      const b = new Piece({
        panelPosition: pos(1, 2),
        player: Player.SELF,
        pieceType: PieceType.ROOK,
      });
      expect(a.equals(b)).toBe(false);
    });

    test("returns true even when id differs (not compared)", () => {
      const a = new Piece({
        id: 1,
        panelPosition: pos(1, 2),
        player: Player.SELF,
        pieceType: PieceType.KNIGHT,
      });
      const b = new Piece({
        id: 99,
        panelPosition: pos(1, 2),
        player: Player.SELF,
        pieceType: PieceType.KNIGHT,
      });
      expect(a.equals(b)).toBe(true);
    });

    test("returns true even when hp differs (not compared)", () => {
      const a = new Piece({
        panelPosition: pos(1, 2),
        player: Player.SELF,
        pieceType: PieceType.KNIGHT,
        hp: 1,
      });
      const b = new Piece({
        panelPosition: pos(1, 2),
        player: Player.SELF,
        pieceType: PieceType.KNIGHT,
        hp: 10,
      });
      expect(a.equals(b)).toBe(true);
    });

    test("returns true even when targetPosition differs (not compared)", () => {
      const a = new Piece({
        panelPosition: pos(1, 2),
        targetPosition: pos(2, 0),
        player: Player.SELF,
        pieceType: PieceType.KNIGHT,
      });
      const b = new Piece({
        panelPosition: pos(1, 2),
        player: Player.SELF,
        pieceType: PieceType.KNIGHT,
      });
      expect(a.equals(b)).toBe(true);
    });
  });
});
