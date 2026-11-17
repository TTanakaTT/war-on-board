<script lang="ts">
  import { PiecesRepository } from "#lib/data/repositories/PieceRepository.ts";
  import { SelectedPanelRepository } from "#lib/data/repositories/SelectedPanelRepository.ts";
  import { TurnRepository } from "#lib/data/repositories/TurnRepository.ts";
  import { getPieceTokenCoordinates } from "#lib/presentation/PieceTokenLayout.ts";
  import { InteractionService } from "#lib/services/InteractionService.ts";
  import PieceToken from "./PieceToken.svelte";

  // Pieces between two panels (see Piece.transitPosition), drawn part of the way along the
  // hop. They still belong to their own panel, so selecting one works like selecting a
  // piece in that panel's token row.
  let selectedPieceId = $derived(SelectedPanelRepository.getPieceId());
  let turn = $derived(TurnRepository.get());
  let transitTokens = $derived(
    PiecesRepository.getAll()
      .filter((piece) => piece.isInTransit)
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
