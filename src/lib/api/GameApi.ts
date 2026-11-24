import {
  DEFAULT_MAX_PIECES_PER_PANEL,
  MOVEMENT_HOP_COST,
  PLAYER_INIT_RESOURCE,
} from "#lib/domain/config.ts";
import {
  ActionError,
  isAdjacent,
  opponentOf,
  PanelState,
  PIECE_TYPES,
  pieceConfig,
  Player,
  SIDES,
  pos,
  posKey,
  stackCountForHp,
  takesMultipleTurnsPerHop,
  type GameActionResult,
  type GameState,
  type GenerationMode,
  type PanelPosition,
  type Piece,
  type PieceType,
  type Result,
  type TurnEndResult,
} from "#lib/domain/model.ts";
import type { GameStateHistoryEntry } from "#lib/domain/types.ts";
import {
  GameStateHistoryRepository,
  HomeBaseRepository,
  LayerRepository,
  MatchStatsRepository,
  PanelRepository,
  PiecesRepository,
  TurnRepository,
} from "#lib/store.svelte.ts";
import { GenerationService } from "#lib/services/GenerationService.ts";
import { MovementRulesService } from "#lib/services/MovementRulesService.ts";
import { PanelsService } from "#lib/services/PanelService.ts";
import { PieceService } from "#lib/services/PieceService.ts";

const fail = (error: ActionError) => ({ ok: false, error }) as const;
const isSide = (value: unknown) => value === Player.SELF || value === Player.OPPONENT;

/**
 * The only entry point that changes game state (UI and AI both call it). Rules overview:
 * - Win by capturing the enemy home base. Infantry > Noble > Rook > Infantry macro balance.
 * - Turn start passives: Noble +1 panel resource, Rook +1 wall (both capped, never lowered),
 *   other types claim their panel. Income = sum of owned panels' resource.
 * - Orders may target any panel; endTurn walks pieces along shortest routes
 *   (MovementRulesService.planEndOfTurn), attacking enemy panels in the way.
 * - An attacker may only target panels whose every defender has defense <= its raw attack.
 * - Wall first: attackers hit the wall; overflow scales their piece damage. Otherwise both
 *   groups deal max(0, attack - HP-weighted defense) * stackCount simultaneously, split by HP.
 * - Attackers enter only when no enemy pieces and no wall remain, in order sequence, up to
 *   maxPiecesPerPanel. Ranged attacks never enter; out-of-range defenders do not counter.
 */
export class GameApi {
  static initializeGame({ layer }: { layer: number }): Result<GameActionResult> {
    PanelRepository.setAll(PanelsService.initialize(layer));
    LayerRepository.set(layer);
    HomeBaseRepository.setAll([
      { player: Player.SELF, panelPosition: pos(1 - layer, 0) },
      { player: Player.OPPONENT, panelPosition: pos(layer - 1, 0) },
    ]);
    PiecesRepository.setAll([]);
    TurnRepository.set({
      player: Player.SELF,
      num: 1,
      resources: { self: PLAYER_INIT_RESOURCE, opponent: PLAYER_INIT_RESOURCE },
      maxPiecesPerPanel: {
        self: DEFAULT_MAX_PIECES_PER_PANEL,
        opponent: DEFAULT_MAX_PIECES_PER_PANEL,
      },
      generationMode: { self: "front", opponent: "front" },
      winner: null,
    });
    MatchStatsRepository.reset();
    this.addResources(Player.SELF);
    GameStateHistoryRepository.clear();
    this.recordHistory();
    return this.ok();
  }

  /**
   * Orders a piece to any panel. A redirect needs banked movement >= MOVEMENT_HOP_COST
   * (an idle piece can always be ordered); a slow piece is locked once it winds up an attack.
   * A target within this turn's reach must be carried out this turn without cancelling another
   * order (MovementRulesService.canMoveTo). Every order goes to the back of the order sequence.
   */
  static assignMove(
    player: Player,
    pieceId: number,
    target: PanelPosition,
  ): Result<GameActionResult> {
    const piece = this.ownPiece(player, pieceId);
    if (typeof piece === "string") return fail(piece);
    const redirectBlocked = takesMultipleTurnsPerHop(piece)
      ? MovementRulesService.isOrderLocked(piece)
      : piece.targetPosition !== undefined && piece.movementPoints < MOVEMENT_HOP_COST;
    if (redirectBlocked) return fail(ActionError.INSUFFICIENT_MOVEMENT_POINTS);
    if (
      !PanelRepository.find(target) ||
      !MovementRulesService.canMoveTo(target, player, pieceId, TurnRepository.maxPieces(player))
    ) {
      return fail(ActionError.TARGET_NOT_REACHABLE);
    }
    PiecesRepository.update({
      ...MovementRulesService.withOrder(piece, target),
      orderSequence: this.nextOrderSequence(),
    });
    return this.ok();
  }

  /** A piece in transit cancels by stopping at the panel it is moving into. */
  static cancelMove(player: Player, pieceId: number): Result<GameActionResult> {
    const piece = this.ownPiece(player, pieceId);
    if (typeof piece === "string") return fail(piece);
    if (
      !piece.targetPosition ||
      !MovementRulesService.canCancelMove(player, pieceId, TurnRepository.maxPieces(player))
    ) {
      return fail(ActionError.CANNOT_CANCEL);
    }
    PiecesRepository.update({ ...piece, targetPosition: piece.transitPosition });
    return this.ok();
  }

  static assignRangedAttack(
    player: Player,
    pieceId: number,
    target: PanelPosition,
  ): Result<GameActionResult> {
    const piece = this.ownPiece(player, pieceId);
    if (typeof piece === "string") return fail(piece);
    if (piece.rangedAttackTargetPosition && piece.movementPoints < MOVEMENT_HOP_COST) {
      return fail(ActionError.INSUFFICIENT_MOVEMENT_POINTS);
    }
    if (!MovementRulesService.canRangedAttack(pieceId, target)) {
      return fail(ActionError.TARGET_NOT_REACHABLE);
    }
    PiecesRepository.update({ ...piece, rangedAttackTargetPosition: target });
    return this.ok();
  }

  static cancelRangedAttack(player: Player, pieceId: number): Result<GameActionResult> {
    const piece = this.ownPiece(player, pieceId);
    if (typeof piece === "string") return fail(piece);
    if (!piece.rangedAttackTargetPosition || takesMultipleTurnsPerHop(piece)) {
      return fail(ActionError.CANNOT_CANCEL);
    }
    PiecesRepository.update({ ...piece, rangedAttackTargetPosition: undefined });
    return this.ok();
  }

  /** Spawns on the first qualifying panel (GenerationService) and merges with a same type. */
  static generatePiece(player: Player, pieceType: PieceType): Result<GameActionResult> {
    const error = this.checkTurn(player);
    if (error) return fail(error);
    if (!this.canAfford(player, pieceType)) return fail(ActionError.INSUFFICIENT_RESOURCES);
    const position = GenerationService.findGenerationPanel(player, pieceType);
    const spawned = position && GenerationService.generate(pieceType, position);
    if (!spawned) return fail(ActionError.NO_GENERATION_PANEL);
    PieceService.mergePiecesAtPosition(spawned);
    return this.ok();
  }

  static setGenerationMode(player: Player, mode: GenerationMode): Result<GameActionResult> {
    const error = this.checkTurn(player);
    if (error) return fail(error);
    const turn = TurnRepository.get();
    TurnRepository.set({ ...turn, generationMode: { ...turn.generationMode, [player]: mode } });
    return this.ok();
  }

  /** Resolves moves, checks victory, then starts the next player's turn. */
  static endTurn(player: Player): Result<TurnEndResult> {
    const error = this.checkTurn(player);
    if (error) return fail(error);
    const combatOutcomes = [
      ...PieceService.finalizePlayerMoves(player),
      ...PieceService.resolveRangedAttacks(player),
    ];
    PieceService.mergeAllPiecesForPlayer(player);
    PanelsService.refreshPanelStates();

    const winner = this.findWinner();
    if (winner) {
      TurnRepository.set({ ...TurnRepository.get(), winner });
      this.recordHistory();
      return this.ok({ combatOutcomes, winner, nextPlayer: undefined });
    }

    const nextPlayer = opponentOf(player);
    PieceService.resetInitialPositions(nextPlayer);
    PieceService.applyPassiveGains(nextPlayer);
    PieceService.accrueMovementForPlayer(nextPlayer);
    const turn = TurnRepository.get();
    TurnRepository.set({
      ...turn,
      player: nextPlayer,
      num: player === Player.OPPONENT ? turn.num + 1 : turn.num,
    });
    this.addResources(nextPlayer);
    this.recordHistory();
    return this.ok({ combatOutcomes, winner: null, nextPlayer });
  }

  /** JSON-safe copy; panel states are reduced to occupied/unoccupied. */
  static getGameState(): GameState {
    const occupied = new Set(PiecesRepository.getAll().map((p) => posKey(p.panelPosition)));
    return structuredClone({
      panels: PanelRepository.getAll().map((panel) => ({
        ...panel,
        panelState: occupied.has(posKey(panel.panelPosition))
          ? PanelState.OCCUPIED
          : PanelState.UNOCCUPIED,
      })),
      pieces: PiecesRepository.getAll(),
      turn: TurnRepository.get(),
      homeBases: HomeBaseRepository.getAll(),
      layer: LayerRepository.get(),
    });
  }

  static loadGameState(snapshot: GameState): Result<GameActionResult> {
    if (!this.isValidGameState(snapshot)) return fail(ActionError.INVALID_GAME_STATE);
    const state = structuredClone(snapshot);
    const occupied = new Set(state.pieces.map((p) => posKey(p.panelPosition)));
    LayerRepository.set(state.layer);
    PanelRepository.setAll(
      state.panels.map((panel) => ({
        ...panel,
        panelState: occupied.has(posKey(panel.panelPosition))
          ? PanelState.OCCUPIED
          : PanelState.UNOCCUPIED,
      })),
    );
    HomeBaseRepository.setAll(state.homeBases);
    PiecesRepository.setAll(state.pieces);
    TurnRepository.set(state.turn);
    return this.ok();
  }

  /** Runs <callback> on <snapshot> (e.g. AI lookahead), then restores state, history and stats. */
  static withTemporaryGameState<T>(snapshot: GameState, callback: () => T): Result<T> {
    const original = this.getGameState();
    const originalHistory = GameStateHistoryRepository.getAll();
    const originalStats = MatchStatsRepository.get();
    const loaded = this.loadGameState(snapshot);
    if (!loaded.ok) return loaded;

    let value: T | undefined;
    let callbackFailed = false;
    try {
      value = callback();
    } catch {
      callbackFailed = true;
    }
    let restoreFailed: boolean;
    try {
      restoreFailed = !this.loadGameState(original).ok;
    } catch {
      restoreFailed = true;
    }
    MatchStatsRepository.set(originalStats);
    GameStateHistoryRepository.setAll(originalHistory);
    if (restoreFailed) return fail(ActionError.TEMPORARY_GAME_STATE_RESTORE_FAILED);
    if (callbackFailed) return fail(ActionError.TEMPORARY_GAME_STATE_CALLBACK_FAILED);
    return { ok: true, value: value as T };
  }

  /** Adjacent panels (and staying) the piece may be ordered to; measured from its transit panel. */
  static getMovableTargets(pieceId: number): PanelPosition[] {
    const piece = PiecesRepository.get(pieceId);
    if (!piece || MovementRulesService.isOrderLocked(piece)) return [];
    const maxPieces = TurnRepository.maxPieces(piece.player);
    const origin = piece.transitPosition ?? piece.initialPosition;
    const candidates = [
      ...PanelRepository.getAll()
        .map((p) => p.panelPosition)
        .filter((p) => isAdjacent(origin, p)),
      origin,
    ];
    const before = MovementRulesService.planEndOfTurn(piece.player, maxPieces);
    return candidates.filter((p) =>
      MovementRulesService.canMoveTo(p, piece.player, pieceId, maxPieces, before),
    );
  }

  static canGenerate(player: Player, pieceType: PieceType): boolean {
    return (
      this.canAfford(player, pieceType) &&
      GenerationService.findGenerationPanel(player, pieceType) !== null
    );
  }

  /** Captured after initializeGame and every endTurn. */
  static getGameStateHistory(): GameStateHistoryEntry[] {
    return structuredClone(GameStateHistoryRepository.getAll());
  }

  private static ok<T extends object = object>(extra?: T): Result<T & GameActionResult> {
    return { ok: true, value: { ...(extra as T), gameState: this.getGameState() } };
  }

  private static checkTurn(player: Player): ActionError | null {
    const turn = TurnRepository.get();
    if (turn.winner) return ActionError.GAME_ALREADY_OVER;
    if (turn.player !== player) return ActionError.NOT_YOUR_TURN;
    return null;
  }

  private static ownPiece(player: Player, pieceId: number): Piece | ActionError {
    const error = this.checkTurn(player);
    if (error) return error;
    const piece = PiecesRepository.get(pieceId);
    if (!piece) return ActionError.PIECE_NOT_FOUND;
    return piece.player === player ? piece : ActionError.PIECE_NOT_OWNED;
  }

  private static canAfford(player: Player, pieceType: PieceType): boolean {
    return (TurnRepository.get().resources[player] ?? 0) >= pieceConfig(pieceType).cost;
  }

  private static addResources(player: Player) {
    const total = PanelRepository.getAll()
      .filter((p) => p.player === player)
      .reduce((sum, p) => sum + p.resource, 0);
    const turn = TurnRepository.get();
    TurnRepository.set({
      ...turn,
      resources: { ...turn.resources, [player]: (turn.resources[player] ?? 0) + total },
    });
    MatchStatsRepository.addGainedResources(player, total);
  }

  /** A home base owned by the other side means that side won. */
  private static findWinner(): Player | null {
    for (const homeBase of HomeBaseRepository.getAll()) {
      const owner = PanelRepository.find(homeBase.panelPosition)?.player;
      if (owner && owner !== homeBase.player && owner !== Player.UNKNOWN) return owner;
    }
    return null;
  }

  private static recordHistory() {
    const snapshot = this.getGameState();
    GameStateHistoryRepository.add({
      sequence: GameStateHistoryRepository.getAll().length,
      capturedAtTurn: snapshot.turn.num,
      snapshot,
      stats: MatchStatsRepository.get(),
    });
  }

  private static nextOrderSequence(): number {
    return Math.max(0, ...PiecesRepository.getAll().map((p) => p.orderSequence ?? 0)) + 1;
  }

  private static isValidGameState(s: GameState): boolean {
    const isPos = (p?: PanelPosition) =>
      !!p && Number.isInteger(p.horizontalLayer) && Number.isInteger(p.verticalLayer);
    const nonNegative = (n: number) => Number.isFinite(n) && n >= 0;
    if (!Number.isInteger(s.layer) || s.layer < 1 || s.panels.length === 0) return false;

    const panelKeys = new Set<string>();
    for (const panel of s.panels) {
      const key = isPos(panel.panelPosition) && posKey(panel.panelPosition);
      if (!key || panelKeys.has(key)) return false;
      if (panel.panelState !== PanelState.OCCUPIED && panel.panelState !== PanelState.UNOCCUPIED)
        return false;
      if (!nonNegative(panel.resource) || !nonNegative(panel.wall)) return false;
      if (!isSide(panel.player) && panel.player !== Player.UNKNOWN) return false;
      panelKeys.add(key);
    }
    const onBoard = (p?: PanelPosition) => isPos(p) && panelKeys.has(posKey(p!));

    const homeBaseSides = new Set(s.homeBases.map((h) => h.player));
    if (s.homeBases.length !== 2 || !SIDES.every((side) => homeBaseSides.has(side))) return false;
    if (!s.homeBases.every((h) => onBoard(h.panelPosition))) return false;

    const ids = new Set<number>();
    for (const piece of s.pieces) {
      if (!Number.isInteger(piece.id) || piece.id < 0 || ids.has(piece.id)) return false;
      ids.add(piece.id);
      if (!isSide(piece.player) || !PIECE_TYPES.includes(piece.pieceType)) return false;
      if (!onBoard(piece.panelPosition) || !onBoard(piece.initialPosition)) return false;
      for (const optional of [
        piece.targetPosition,
        piece.rangedAttackTargetPosition,
        piece.transitPosition,
      ]) {
        if (optional && !onBoard(optional)) return false;
      }
      if (!Number.isInteger(piece.stackCount) || piece.stackCount < 1) return false;
      if (!nonNegative(piece.hp) || stackCountForHp(piece.pieceType, piece.hp) !== piece.stackCount)
        return false;
      if (!nonNegative(piece.movementPoints)) return false;
      if (
        piece.orderSequence !== undefined &&
        (!Number.isInteger(piece.orderSequence) || piece.orderSequence < 1)
      )
        return false;
    }

    const { turn } = s;
    if (!isSide(turn.player)) return false;
    if (turn.winner !== null && !isSide(turn.winner)) return false;
    if (!Number.isInteger(turn.num) || turn.num < 1) return false;
    return SIDES.every((side) => {
      const maxPieces = turn.maxPiecesPerPanel[side];
      const mode = turn.generationMode[side];
      return (
        nonNegative(turn.resources[side]) &&
        Number.isInteger(maxPieces) &&
        maxPieces >= 1 &&
        (mode === "front" || mode === "rear")
      );
    });
  }
}
