<script lang="ts">
  import { PiecesRepository } from "$lib/data/repositories/PieceRepository";
  import { getPieceTokenOffset } from "$lib/presentation/PieceTokenLayout";
  import { BoardLayout } from "$lib/presentation/BoardLayout";
  import { Player } from "$lib/domain/enums/Player";

  let piecesWithMoves = $derived.by(() => {
    return PiecesRepository.getAll()
      .filter((piece) => piece.targetPosition)
      .map((piece) => {
        const sourcePieces = PiecesRepository.getPiecesByPosition(piece.panelPosition);
        const pieceIndex = sourcePieces.findIndex((sourcePiece) => sourcePiece.id === piece.id);
        const start = BoardLayout.getCoordinates(piece.panelPosition);
        const end = BoardLayout.getCoordinates(piece.targetPosition!);

        return {
          piece,
          startX: start.x + getPieceTokenOffset(pieceIndex, sourcePieces.length),
          startY: start.y,
          endX: end.x,
          endY: end.y,
        };
      });
  });
</script>

<svg class="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible">
  <defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" />
    </marker>
  </defs>

  {#each piecesWithMoves as movingPiece (movingPiece.piece.id)}
    {@const color =
      movingPiece.piece.player === Player.SELF ? "stroke-player-self" : "stroke-player-opponent"}
    {@const textColor =
      movingPiece.piece.player === Player.SELF ? "text-player-self" : "text-player-opponent"}

    <g class="{textColor} opacity-35">
      <line
        x1={movingPiece.startX}
        y1={movingPiece.startY}
        x2={movingPiece.endX}
        y2={movingPiece.endY}
        class={color}
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
