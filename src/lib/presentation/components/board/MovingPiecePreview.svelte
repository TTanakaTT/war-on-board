<script lang="ts">
  import { PiecesRepository } from "#lib/data/repositories/PieceRepository.ts";
  import { BoardLayout } from "#lib/presentation/BoardLayout.ts";
  import { PIECE_PREVIEW_ANIMATION_MS } from "#lib/presentation/constants/PieceTokenConstants.ts";
  import { getPieceTokenCoordinates } from "#lib/presentation/PieceTokenLayout.ts";
  import { PieceService } from "#lib/services/PieceService.ts";
  import PieceToken from "./PieceToken.svelte";

  type MovingPreview = {
    id: number;
    startX: number;
    startY: number;
    travelX: number;
    travelY: number;
    piece: ReturnType<typeof PiecesRepository.getAll>[number];
  };

  // Each pending order animates from where the piece is drawn now to where it will be at
  // the end of this turn — part of the way between two panels for a slow piece.
  let movingPreviews = $derived.by<MovingPreview[]>(() => {
    return PiecesRepository.getAll()
      .filter((piece) => piece.targetPosition || piece.isInTransit)
      .map((piece) => {
        const start = getPieceTokenCoordinates(piece);
        const end = BoardLayout.getPointCoordinates(PieceService.previewEndOfTurnPoint(piece));

        return {
          id: piece.id,
          startX: start.x,
          startY: start.y,
          travelX: end.x - start.x,
          travelY: end.y - start.y,
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
        <div class="rotate-90 lg:rotate-0">
          <PieceToken piece={preview.piece} />
        </div>
      </div>
    </div>
  {/each}
</div>
