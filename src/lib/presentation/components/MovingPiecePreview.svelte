<script lang="ts">
  import { PiecesRepository } from "$lib/data/repositories/PieceRepository";
  import { BoardLayout } from "$lib/presentation/BoardLayout";
  import PieceToken from "$lib/presentation/components/PieceToken.svelte";
  import { PIECE_PREVIEW_ANIMATION_MS } from "$lib/presentation/constants/PieceTokenConstants";
  import { getPieceTokenOffset } from "$lib/presentation/PieceTokenLayout";

  type MovingPreview = {
    id: number;
    startX: number;
    startY: number;
    travelX: number;
    travelY: number;
    piece: ReturnType<typeof PiecesRepository.getAll>[number];
  };

  let movingPreviews = $derived.by<MovingPreview[]>(() => {
    return PiecesRepository.getAll()
      .filter((piece) => piece.targetPosition)
      .map((piece) => {
        const sourcePieces = PiecesRepository.getPiecesByPosition(piece.panelPosition);
        const pieceIndex = sourcePieces.findIndex((sourcePiece) => sourcePiece.id === piece.id);
        const sourceCoordinates = BoardLayout.getCoordinates(piece.panelPosition);
        const targetCoordinates = BoardLayout.getCoordinates(piece.targetPosition!);
        const startX = sourceCoordinates.x + getPieceTokenOffset(pieceIndex, sourcePieces.length);

        return {
          id: piece.id,
          startX,
          startY: sourceCoordinates.y,
          travelX: targetCoordinates.x - startX,
          travelY: targetCoordinates.y - sourceCoordinates.y,
          piece,
        };
      });
  });
</script>

<div class="pointer-events-none absolute inset-0 z-20 overflow-visible">
  {#each movingPreviews as preview (preview.id)}
    <div
      class="absolute -translate-x-1/2 -translate-y-1/2"
      style="left: {preview.startX}px; top: {preview.startY}px;"
    >
      <div
        class="piece-preview-motion drop-shadow-md"
        style="--piece-preview-travel-x: {preview.travelX}px; --piece-preview-travel-y: {preview.travelY}px; --piece-preview-duration: {PIECE_PREVIEW_ANIMATION_MS}ms;"
      >
        <PieceToken piece={preview.piece} />
      </div>
    </div>
  {/each}
</div>
