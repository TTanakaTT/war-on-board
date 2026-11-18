import { RESOURCE_THRESHOLD_FOR_GENERATION } from "#lib/domain/config.ts";
import {
  createPiece,
  isInTransit,
  opponentOf,
  PanelState,
  pieceConfig,
  PieceType,
  samePos,
  type PanelPosition,
  type Player,
} from "#lib/domain/model.ts";
import {
  HomeBaseRepository,
  PanelRepository,
  PiecesRepository,
  TurnRepository,
} from "#lib/store.svelte.ts";
import { MovementRulesService, type EndOfTurnPlan } from "#lib/services/MovementRulesService.ts";
import { PieceService } from "#lib/services/PieceService.ts";

export class GenerationService {
  /**
   * First owned panel with resource >= threshold and room for the new piece.
   * "rear": home base first, then larger |horizontalLayer|. "front": closest horizontally to
   * the enemy home base. Ties: lower verticalLayer. Without <pieceType> the piece counts as
   * non-mergeable.
   */
  static findGenerationPanel(player: Player, pieceType?: PieceType): PanelPosition | null {
    const turn = TurnRepository.get();
    const maxPieces = TurnRepository.maxPieces(player);
    const home = HomeBaseRepository.getByPlayer(player)?.panelPosition;
    const enemyHome = HomeBaseRepository.getByPlayer(opponentOf(player))?.panelPosition;
    const mode = turn.generationMode[player] ?? "rear";

    const rank = (p: PanelPosition): number[] =>
      mode === "rear"
        ? [samePos(home, p) ? 0 : 1, -Math.abs(p.horizontalLayer), p.verticalLayer]
        : [
            enemyHome ? Math.abs(p.horizontalLayer - enemyHome.horizontalLayer) : 0,
            p.verticalLayer,
          ];
    const candidates = PanelRepository.getAll()
      .filter((p) => p.player === player && p.resource >= RESOURCE_THRESHOLD_FOR_GENERATION)
      .map((p) => p.panelPosition)
      .sort((a, b) => {
        const [ra, rb] = [rank(a), rank(b)];
        const i = ra.findIndex((value, index) => value !== rb[index]);
        return i < 0 ? 0 : ra[i] - rb[i];
      });

    let plan: EndOfTurnPlan | undefined;
    const currentPlan = () => (plan ??= MovementRulesService.planEndOfTurn(player, maxPieces));
    return (
      candidates.find((position) =>
        this.hasRoom(position, player, maxPieces, currentPlan, pieceType),
      ) ?? null
    );
  }

  /**
   * A mergeable type always fits next to a same-type piece (it merges right away). Otherwise
   * the panel needs room now, and the end-of-turn plan with the new piece must keep capacity
   * and cancel no order in progress.
   */
  private static hasRoom(
    position: PanelPosition,
    player: Player,
    maxPieces: number,
    currentPlan: () => EndOfTurnPlan,
    pieceType?: PieceType,
  ): boolean {
    const own = PiecesRepository.getPiecesByPosition(position).filter((p) => p.player === player);
    if (
      pieceType &&
      pieceConfig(pieceType).mergeable &&
      own.some((p) => p.pieceType === pieceType && !isInTransit(p))
    ) {
      return true;
    }
    if (own.length + 1 > maxPieces) return false;

    const newPiece = createPiece({
      id: PieceService.generateNextId(),
      panelPosition: position,
      player,
      // Any non-mergeable type stands in for an unknown type.
      pieceType: pieceType ?? PieceType.ROOK,
    });
    return MovementRulesService.canPlaceNewPiece(newPiece, maxPieces, currentPlan());
  }

  /** Spends the cost and places a piece for the current player; returns where, or null. */
  static generate(
    pieceType: PieceType = PieceType.INFANTRY,
    position?: PanelPosition,
  ): PanelPosition | null {
    const turn = TurnRepository.get();
    const cost = pieceConfig(pieceType).cost;
    const resources = turn.resources[turn.player] ?? 0;
    if (resources < cost) return null;

    const target = position ?? this.findGenerationPanel(turn.player, pieceType);
    const panel = target && PanelRepository.find(target);
    if (!target || !panel) return null;

    TurnRepository.set({
      ...turn,
      resources: { ...turn.resources, [turn.player]: resources - cost },
    });
    PiecesRepository.add(
      createPiece({
        id: PieceService.generateNextId(),
        panelPosition: target,
        player: turn.player,
        pieceType,
      }),
    );
    PanelRepository.update({ ...panel, panelState: PanelState.OCCUPIED, player: turn.player });
    return target;
  }
}
