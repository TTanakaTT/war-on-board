<script lang="ts">
  import { PiecesRepository } from "#lib/data/repositories/PieceRepository.ts";
  import { getPieceTokenCoordinates } from "#lib/presentation/PieceTokenLayout.ts";
  import { BoardLayout } from "#lib/presentation/BoardLayout.ts";
  import { Player } from "#lib/domain/enums/Player.ts";
  import type { Piece } from "#lib/domain/entities/Piece.ts";
  import type { PanelPosition } from "#lib/domain/entities/PanelPosition.ts";

  type Arrow = {
    key: string;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    colorClass: string;
  };

  function arrowColorClass(piece: Piece, isRangedAttack: boolean): string {
    if (isRangedAttack) return "text-panel-ranged-target dark:text-panel-ranged-target-dark";
    return piece.player === Player.SELF ? "text-player-self" : "text-player-opponent";
  }

  function toArrow(piece: Piece, target: PanelPosition, isRangedAttack: boolean): Arrow {
    const start = getPieceTokenCoordinates(piece);
    const end = BoardLayout.getCoordinates(target);

    return {
      key: `${piece.id}-${isRangedAttack ? "ranged" : "move"}`,
      startX: start.x,
      startY: start.y,
      endX: end.x,
      endY: end.y,
      colorClass: arrowColorClass(piece, isRangedAttack),
    };
  }

  let arrows = $derived.by(() => {
    const pieces = PiecesRepository.getAll();
    const moveArrows = pieces
      .filter((piece) => piece.targetPosition)
      .map((piece) => toArrow(piece, piece.targetPosition!, false));
    const rangedAttackArrows = pieces
      .filter((piece) => piece.rangedAttackTargetPosition)
      .map((piece) => toArrow(piece, piece.rangedAttackTargetPosition!, true));
    return [...moveArrows, ...rangedAttackArrows];
  });
</script>

<svg class="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible">
  <defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" />
    </marker>
  </defs>

  {#each arrows as arrow (arrow.key)}
    <g class="{arrow.colorClass} opacity-35">
      <line
        x1={arrow.startX}
        y1={arrow.startY}
        x2={arrow.endX}
        y2={arrow.endY}
        stroke="currentColor"
        stroke-width="2"
        marker-end="url(#arrowhead)"
        stroke-dasharray="8 4"
      >
        <animate
          attributeName="stroke-dashoffset"
          from="24"
          to="0"
          dur="1.5s"
          repeatCount="indefinite"
        />
      </line>
    </g>
  {/each}
</svg>
