<script lang="ts">
  import { PiecesRepository } from "$lib/data/repositories/PieceRepository";
  import { BoardLayout } from "$lib/presentation/BoardLayout";
  import { Player } from "$lib/domain/enums/Player";

  let piecesWithMoves = $derived(PiecesRepository.getAll().filter((p) => p.targetPosition));
</script>

<svg class="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible">
  <defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" />
    </marker>
  </defs>

  {#each piecesWithMoves as piece (piece.id)}
    {@const start = BoardLayout.getCoordinates(piece.panelPosition)}
    {@const end = BoardLayout.getCoordinates(piece.targetPosition!)}
    {@const color = piece.player === Player.SELF ? "stroke-white" : "stroke-black"}
    {@const textColor = piece.player === Player.SELF ? "text-white" : "text-black"}

    <g class="{textColor} opacity-60">
      <line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        class={color}
        stroke-width="3"
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

      <circle r="15" fill="currentColor" class="opacity-20">
        <animateMotion
          dur="3s"
          repeatCount="indefinite"
          path="M {start.x} {start.y} L {end.x} {end.y}"
        />
      </circle>
    </g>
  {/each}
</svg>
