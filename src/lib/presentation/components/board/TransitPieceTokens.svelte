<script lang="ts">
  import { PiecesRepository, SelectionRepository, TurnRepository } from "#lib/store.svelte.ts";
  import { isInTransit } from "#lib/domain/model.ts";
  import { getPieceTokenCoordinates } from "#lib/presentation/layout.ts";
  import { InteractionService } from "#lib/services/InteractionService.ts";
  import PieceToken from "./PieceToken.svelte";

  // Pieces in transit, drawn part of the way along their hop.
  let selectedPieceId = $derived(SelectionRepository.getPieceId());
  let turn = $derived(TurnRepository.get());
  let transitTokens = $derived(
    PiecesRepository.getAll()
      .filter((piece) => isInTransit(piece))
      .map((piece) => ({ piece, coordinates: getPieceTokenCoordinates(piece) })),
  );
</script>

<div class="pointer-events-none absolute inset-0 z-20 overflow-visible">
  {#each transitTokens as { piece, coordinates } (piece.id)}
    <button
      class="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 opacity-40 {piece.player ===
      turn.player
        ? 'cursor-pointer'
        : ''}"
      style="left: {coordinates.x}px; top: {coordinates.y}px;"
      type="button"
      onclick={() => InteractionService.pieceChange(piece)}
    >
      <div class="rotate-90 lg:rotate-0">
        <PieceToken {piece} isSelected={piece.id === selectedPieceId} />
      </div>
    </button>
  {/each}
</div>
