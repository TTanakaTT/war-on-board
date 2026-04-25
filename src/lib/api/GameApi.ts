import type { PanelPosition } from "$lib/domain/entities/PanelPosition";
import type { PieceType } from "$lib/domain/enums/PieceType";
import type { Player } from "$lib/domain/enums/Player";
import type { GenerationMode } from "$lib/domain/entities/Turn";
import type { Result, TurnEndResult } from "$lib/domain/types/api";
import { PanelPosition as PanelPositionClass } from "$lib/domain/entities/PanelPosition";
import { Piece } from "$lib/domain/entities/Piece";
import { HomeBase } from "$lib/domain/entities/HomeBase";
import { Player as PlayerClass } from "$lib/domain/enums/Player";
import { PanelsService } from "$lib/services/PanelService";
import { PanelRepository } from "$lib/data/repositories/PanelRepository";
import { PiecesRepository } from "$lib/data/repositories/PieceRepository";
import { TurnRepository } from "$lib/data/repositories/TurnRepository";
import { HomeBaseRepository } from "$lib/data/repositories/HomeBaseRepository";
import { LayerRepository } from "$lib/data/repositories/LayerRepository";
import { MovementRulesService } from "$lib/services/MovementRulesService";
import { PieceService } from "$lib/services/PieceService";
import { VictoryService } from "$lib/services/VictoryService";
import { GenerationService } from "$lib/services/GenerationService";
import {
  PLAYER_INIT_RESOURCE,
  DEFAULT_MAX_PIECES_PER_PANEL,
} from "$lib/domain/constants/GameConstants";
import { ActionError } from "$lib/domain/enums/ActionError";

/**
 * GameApi — the sole entry point for all game-state-changing operations.
 *
 * Every action that a player or the AI can perform MUST go through this class.
 * UI components and AI services call GameApi; they never mutate game state directly.
 *
 * ## Game overview
 *
 * Hex-map turn-based strategy game with three unit types (Knight / Bishop / Rook)
 * forming a rock-paper-scissors macro balance:
 *   - Attack (Knight) > Economy (Bishop): Knight captures panels, nullifying investment.
 *   - Economy (Bishop) > Defence (Rook): accumulated resources fund an army to breach walls.
 *   - Defence (Rook) > Attack (Knight): auto-repairing walls stall Knight advances cheaply.
 *
 * Victory condition: capture the opponent's home base panel.
 *
 * ## Unit types
 *
 * Each type is defined in `PieceType.config` (cost, maxHp, attackPowerAgainstPiece,
 * attackPowerAgainstWall). Passive effects are applied at the start of each player's turn
 * by `endTurn`:
 *   - **Knight**: claims ownership of the panel it occupies.
 *   - **Bishop**: increases the panel's resource by 1 (capped by PASSIVE_RESOURCE_CAP).
 *   - **Rook**: increases the panel's castle by 1 (capped by PASSIVE_CASTLE_CAP;
 *     never reduces existing values above the cap, e.g. home base castle = 10).
 *
 * ## Combat rules (resolved inside `endTurn`)
 *
 * ### Castle-first rule
 * If the target panel has an enemy castle (castle > 0), all attackers first deal their
 * `attackPowerAgainstWall` to the castle.
 *
 * If the total wall damage exceeds the remaining castle value, the overflow ratio
 * `(totalWallDamage - castleBefore) / totalWallDamage` is applied to the attackers'
 * total `attackPowerAgainstPiece`, and that scaled damage is dealt to enemy units on
 * the target panel in the same action.
 *
 * Overflow wall damage is distributed across all enemy units in proportion to their
 * current HP and may leave fractional HP values. During that same overflow resolution,
 * defenders counterattack with their full `attackPowerAgainstPiece`; defender damage is
 * not scaled down by the wall overflow ratio and still occurs even if a defender is also removed.
 *
 * ### Multi-unit simultaneous combat
 * When castle = 0 before the attack and enemy pieces are present:
 *   1. **Damage accumulation** — all attackers' `attackPowerAgainstPiece` is summed, and all defenders'
 *      `attackPowerAgainstPiece` is summed.
 *   2. **Proportional distribution** — each side's incoming damage is split across that side's current units
 *      in proportion to their current HP.
 *   3. **Simultaneous application** — damage is applied at the same time. Units with HP <= 0 are removed.
 *   4. **Fractional HP** — proportional damage may leave fractional HP values on surviving units.
 *
 * ### Entry condition
 * After wall resolution and any resulting unit damage, attackers enter the panel only if ALL of:
 *   - No enemy units remain on the panel.
 *   - Castle value is 0.
 * Otherwise attackers stay at their origin with `targetPosition` cleared.
 *
 * ## Turn flow (executed by `endTurn`)
 *
 *   1. Finalize current player's moves (combat resolution for all pending moves).
 *   2. Refresh panel ownership based on piece positions.
 *   3. Check victory (home base capture).
 *   4. Switch to next player.
 *   5. Reset initial positions + apply passive gains for the next player.
 *   6. Add resources (sum of owned panels' resource values).
 *
 * ## Resource system
 *
 * - Turn start: player gains resources equal to the sum of `resource` on all owned panels.
 * - Generation requires a panel with `resource >= RESOURCE_THRESHOLD_FOR_GENERATION`,
 *   owned by the player, and not at max piece capacity.
 * - Generation panel priority (mode "rear"): home base first, then highest |horizontalLayer|.
 *   Mode "front": lowest |horizontalLayer| first.
 */
export class GameApi {
  // ── Actions ────────────────────────────────────────────────────

  /**
   * Initialize a new game.
   *
   * Creates the hex board with the given layer count, places home bases symmetrically,
   * and sets up the initial turn state.
   *
   * @param config.layer - Number of layers for the hex board (determines board size).
   *
   * **Effects:**
   * - Board panels created. Home base panels receive initial resource and castle values.
   * - Turn 1 begins for Player.SELF with initial resource income.
   */
  static initializeGame(config: { layer: number }): Result {
    const { layer } = config;

    // Board setup
    const panels = PanelsService.initialize(layer);
    PanelRepository.setAll(panels);
    LayerRepository.set(layer);

    // Home bases (use `1 - layer` instead of `-(layer - 1)` to avoid -0 when layer=1)
    HomeBaseRepository.setAll([
      new HomeBase({
        player: PlayerClass.SELF,
        panelPosition: new PanelPositionClass({
          horizontalLayer: 1 - layer,
          verticalLayer: 0,
        }),
      }),
      new HomeBase({
        player: PlayerClass.OPPONENT,
        panelPosition: new PanelPositionClass({
          horizontalLayer: layer - 1,
          verticalLayer: 0,
        }),
      }),
    ]);

    // Clear pieces
    PiecesRepository.setAll([]);

    // Turn state
    TurnRepository.set({
      player: PlayerClass.SELF,
      num: 1,
      resources: {
        [String(PlayerClass.SELF)]: PLAYER_INIT_RESOURCE,
        [String(PlayerClass.OPPONENT)]: PLAYER_INIT_RESOURCE,
      },
      maxPiecesPerPanel: {
        [String(PlayerClass.SELF)]: DEFAULT_MAX_PIECES_PER_PANEL,
        [String(PlayerClass.OPPONENT)]: DEFAULT_MAX_PIECES_PER_PANEL,
      },
      generationMode: {
        [String(PlayerClass.SELF)]: "front",
        [String(PlayerClass.OPPONENT)]: "front",
      },
      winner: null,
    });

    // Add first player's income
    this.addResources(PlayerClass.SELF);

    return { ok: true, value: undefined };
  }

  /**
   * Assign a move target for a piece.
   *
   * The piece must belong to the acting player and the target must be adjacent
   * to the piece's initial position (start-of-turn position).
   *
   * @param player - The player performing the action.
   * @param pieceId - ID of the piece to move.
   * @param target - The target panel position.
   *
   * **Preconditions:**
   * - Game not over (`winner === null`).
   * - It is `player`'s turn.
   * - Piece exists and belongs to `player`.
   * - Target is adjacent to the piece's `initialPosition`.
   * - Target satisfies movement rules (enemy panel = always allowed;
   *   friendly panel = projected count + 1 <= maxPiecesPerPanel).
   *
   * **Effects:**
   * - Sets `piece.targetPosition` to `target`.
   *
   * **Errors:** GAME_ALREADY_OVER, NOT_YOUR_TURN, PIECE_NOT_FOUND,
   * PIECE_NOT_OWNED, TARGET_NOT_REACHABLE.
   */
  static assignMove(player: Player, pieceId: number, target: PanelPosition): Result {
    const turn = TurnRepository.get();
    if (turn.winner) return { ok: false, error: ActionError.GAME_ALREADY_OVER };
    if (turn.player !== player) return { ok: false, error: ActionError.NOT_YOUR_TURN };

    const piece = PiecesRepository.getAll().find((p) => p.id === pieceId);
    if (!piece) return { ok: false, error: ActionError.PIECE_NOT_FOUND };
    if (piece.player !== player) return { ok: false, error: ActionError.PIECE_NOT_OWNED };

    // Target must be adjacent to initialPosition or equal to it (stay)
    if (!piece.initialPosition.isAdjacent(target) && !piece.initialPosition.equals(target)) {
      return { ok: false, error: ActionError.TARGET_NOT_REACHABLE };
    }

    // Capacity check for friendly panels
    const maxPieces = turn.maxPiecesPerPanel[String(player)] ?? DEFAULT_MAX_PIECES_PER_PANEL;
    if (!MovementRulesService.canMoveTo(target, player, pieceId, maxPieces)) {
      return { ok: false, error: ActionError.TARGET_NOT_REACHABLE };
    }

    PiecesRepository.update(new Piece({ ...piece, targetPosition: target }));
    return { ok: true, value: undefined };
  }

  /**
   * Cancel a piece's pending move.
   *
   * The piece must have a `targetPosition` set, and cancelling must not
   * cause the origin panel to exceed its capacity.
   *
   * @param player - The player performing the action.
   * @param pieceId - ID of the piece whose move to cancel.
   *
   * **Preconditions:**
   * - Game not over.
   * - It is `player`'s turn.
   * - Piece exists, belongs to `player`, and has a pending `targetPosition`.
   * - Cancelling does not exceed capacity at the piece's current panel.
   *
   * **Effects:**
   * - Clears `piece.targetPosition` to `undefined`.
   *
   * **Errors:** GAME_ALREADY_OVER, NOT_YOUR_TURN, PIECE_NOT_FOUND,
   * PIECE_NOT_OWNED, CANNOT_CANCEL.
   */
  static cancelMove(player: Player, pieceId: number): Result {
    const turn = TurnRepository.get();
    if (turn.winner) return { ok: false, error: ActionError.GAME_ALREADY_OVER };
    if (turn.player !== player) return { ok: false, error: ActionError.NOT_YOUR_TURN };

    const piece = PiecesRepository.getAll().find((p) => p.id === pieceId);
    if (!piece) return { ok: false, error: ActionError.PIECE_NOT_FOUND };
    if (piece.player !== player) return { ok: false, error: ActionError.PIECE_NOT_OWNED };
    if (!piece.targetPosition) return { ok: false, error: ActionError.CANNOT_CANCEL };

    const maxPieces = turn.maxPiecesPerPanel[String(player)] ?? DEFAULT_MAX_PIECES_PER_PANEL;
    if (!MovementRulesService.canCancelMove(piece.panelPosition, player, pieceId, maxPieces)) {
      return { ok: false, error: ActionError.CANNOT_CANCEL };
    }

    PiecesRepository.update(new Piece({ ...piece, targetPosition: undefined }));
    return { ok: true, value: undefined };
  }

  /**
   * Generate (spawn) a new piece for the given player.
   *
   * Consumes resources equal to the piece type's cost and places the piece
   * on the best available generation panel.
   *
   * @param player - The player performing the action.
   * @param pieceType - The type of piece to generate.
   *
   * **Preconditions:**
   * - Game not over.
   * - It is `player`'s turn.
   * - Player has resources >= `pieceType.config.cost`.
   * - At least one panel meets generation requirements.
   *
   * **Effects:**
   * - Deducts cost from player's resources.
   * - Creates a new piece on the selected panel.
   * - Panel state updated to OCCUPIED.
   *
   * **Errors:** GAME_ALREADY_OVER, NOT_YOUR_TURN, INSUFFICIENT_RESOURCES,
   * NO_GENERATION_PANEL.
   */
  static generatePiece(player: Player, pieceType: PieceType): Result {
    const turn = TurnRepository.get();
    if (turn.winner) return { ok: false, error: ActionError.GAME_ALREADY_OVER };
    if (turn.player !== player) return { ok: false, error: ActionError.NOT_YOUR_TURN };

    const cost = pieceType.config.cost;
    const currentResources = turn.resources[String(player)] ?? 0;
    if (currentResources < cost) return { ok: false, error: ActionError.INSUFFICIENT_RESOURCES };

    const generatePosition = GenerationService.findGenerationPanel(player, pieceType);
    if (!generatePosition) return { ok: false, error: ActionError.NO_GENERATION_PANEL };

    const spawnedPosition = GenerationService.generate(pieceType, generatePosition);
    if (!spawnedPosition) return { ok: false, error: ActionError.NO_GENERATION_PANEL };

    PieceService.mergePiecesAtPosition(spawnedPosition);
    return { ok: true, value: undefined };
  }

  /**
   * Switch the generation mode between "front" and "rear" for the given player.
   *
   * @param player - The player performing the action.
   * @param mode - The new generation mode.
   *
   * **Preconditions:**
   * - Game not over.
   * - It is `player`'s turn.
   *
   * **Effects:**
   * - Updates the player's generation mode in turn state.
   *
   * **Errors:** GAME_ALREADY_OVER, NOT_YOUR_TURN.
   */
  static setGenerationMode(player: Player, mode: GenerationMode): Result {
    const turn = TurnRepository.get();
    if (turn.winner) return { ok: false, error: ActionError.GAME_ALREADY_OVER };
    if (turn.player !== player) return { ok: false, error: ActionError.NOT_YOUR_TURN };

    const newGenerationMode = { ...turn.generationMode, [String(player)]: mode };
    TurnRepository.set({ ...turn, generationMode: newGenerationMode });
    return { ok: true, value: undefined };
  }

  /**
   * End the current player's turn.
   *
   * Executes the full turn-end sequence:
   *   1. Finalize all pending moves (grouped by target, combat resolved per group).
   *   2. Refresh panel states.
   *   3. Check victory condition (home base captured → game ends).
   *   4. Switch player.
   *   5. Reset initial positions + apply passive gains for the next player.
   *   6. Add resource income for the next player.
   *
   * See class-level JSDoc for combat rules, passive effects, and entry conditions.
   *
   * @param player - The player ending their turn.
   * @returns TurnEndResult with combat outcomes, winner, and next player.
   *
   * **Preconditions:**
   * - Game not over.
   * - It is `player`'s turn.
   *
   * **Errors:** GAME_ALREADY_OVER, NOT_YOUR_TURN.
   */
  static endTurn(player: Player): Result<TurnEndResult> {
    const turn = TurnRepository.get();
    if (turn.winner) return { ok: false, error: ActionError.GAME_ALREADY_OVER };
    if (turn.player !== player) return { ok: false, error: ActionError.NOT_YOUR_TURN };

    // 1. Finalize current player's moves (combat resolution)
    const combatOutcomes = PieceService.finalizePlayerMoves(player);

    // 1b. Merge same-type mergeable units that ended up on the same panel
    PieceService.mergeAllPiecesForPlayer(player);

    // 2. Refresh panel ownership
    PanelsService.refreshPanelStates();

    // 3. Check victory
    VictoryService.applyVictory();
    const postVictoryTurn = TurnRepository.get();
    if (postVictoryTurn.winner) {
      return {
        ok: true,
        value: {
          combatOutcomes,
          winner: postVictoryTurn.winner,
          nextPlayer: undefined,
        },
      };
    }

    // 4. Switch to next player
    const nextPlayer = player === PlayerClass.SELF ? PlayerClass.OPPONENT : PlayerClass.SELF;
    const nextNum = player === PlayerClass.OPPONENT ? turn.num + 1 : turn.num;

    // 5. Reset initial positions + apply passive gains for next player
    PieceService.resetInitialPositions(nextPlayer);
    PieceService.applyPassiveGains(nextPlayer);

    // 6. Update turn state
    TurnRepository.set({
      ...TurnRepository.get(),
      player: nextPlayer,
      num: nextNum,
    });

    // 7. Add resource income for the next player
    this.addResources(nextPlayer);

    return {
      ok: true,
      value: {
        combatOutcomes,
        winner: null,
        nextPlayer,
      },
    };
  }

  private static addResources(player: Player) {
    const turn = TurnRepository.get();
    const panels = PanelRepository.getAll().filter((p) => p.player === player);
    const totalResource = panels.reduce((sum, p) => sum + (p.resource || 0), 0);

    const newResources = { ...turn.resources };
    newResources[String(player)] = (newResources[String(player)] || 0) + totalResource;

    TurnRepository.set({ ...turn, resources: newResources });
  }

  // ── Queries ────────────────────────────────────────────────────

  /**
   * Get all panel positions that a piece can move to.
   *
   * Returns adjacent panels that satisfy movement rules:
   * - Enemy panels (enemy pieces or enemy castle) are always included.
   * - Friendly/neutral panels are included only if projected piece count + 1 <= maxPiecesPerPanel.
   *
   * Also includes the piece's initial position (to allow "staying") if capacity allows.
   *
   * @param pieceId - The ID of the piece to query.
   * @returns Array of reachable PanelPosition, or empty if piece not found.
   */
  static getMovableTargets(pieceId: number): PanelPosition[] {
    const piece = PiecesRepository.getAll().find((p) => p.id === pieceId);
    if (!piece) return [];

    const turn = TurnRepository.get();
    const maxPieces = turn.maxPiecesPerPanel[String(piece.player)] ?? DEFAULT_MAX_PIECES_PER_PANEL;

    // Get all panels adjacent to the piece's initial position
    const allPanels = PanelRepository.getAll();
    const adjacentPositions = allPanels
      .filter((p) => piece.initialPosition.isAdjacent(p.panelPosition))
      .map((p) => p.panelPosition);

    // Include the piece's own position (stay)
    const candidates = [...adjacentPositions, piece.initialPosition];

    return candidates.filter((pos) =>
      MovementRulesService.canMoveTo(pos, piece.player, pieceId, maxPieces),
    );
  }

  /**
   * Check if a player can generate a piece of the given type.
   *
   * @param player - The player to check.
   * @param pieceType - The piece type to check affordability for.
   * @returns `true` if the player has enough resources AND a valid generation panel exists.
   */
  static canGenerate(player: Player, pieceType: PieceType): boolean {
    const turn = TurnRepository.get();
    const currentResources = turn.resources[String(player)] ?? 0;
    if (currentResources < pieceType.config.cost) return false;
    return GenerationService.findGenerationPanel(player, pieceType) !== null;
  }
}
