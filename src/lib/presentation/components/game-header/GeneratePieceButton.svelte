<script lang="ts">
  import { PieceType } from "$lib/domain/enums/PieceType";
  import { GameApiClient } from "$lib/api/GameApiClient";
  import { TurnRepository } from "$lib/data/repositories/TurnRepository";
  import Icon from "$lib/presentation/components/primitives/Icon.svelte";
  import { pieceTypeLabel } from "$lib/presentation/piecePresentation";
  import { MatchService } from "$lib/services/MatchService";

  let {
    pieceType,
    compact = false,
    onPreviewChange,
    additionalClass = "",
  }: {
    pieceType: PieceType;
    compact?: boolean;
    onPreviewChange?: (previewCost: number | undefined) => void;
    additionalClass?: string;
  } = $props();

  let turn = $derived(TurnRepository.get());
  let actingPlayer = $derived(turn.player);
  let currentResources = $derived(turn.resources[String(actingPlayer)] ?? 0);
  let canAfford = $derived(currentResources >= pieceType.config.cost);
  let isHumanTurn = $derived(MatchService.getControllerForCurrentTurn() === "human");
  let isAutomationRunning = $derived(MatchService.isAutomationRunning());
  let buttonClass = $derived(compact ? "h-11 w-11 rounded-2xl px-0" : "");

  function startPreview(): void {
    onPreviewChange?.(pieceType.config.cost);
  }

  function endPreview(): void {
    onPreviewChange?.(undefined);
  }
</script>

<div
  role="presentation"
  onmouseenter={startPreview}
  onmouseleave={endPreview}
  title={compact ? pieceTypeLabel(pieceType) : undefined}
  aria-label={pieceTypeLabel(pieceType)}
>
  <button
    type="button"
    class="border-primary dark:border-primary-dark text-onbackground dark:text-onbackground-dark shadow-primary dark:shadow-primary-dark hover:ring-primary dark:hover:ring-primary-dark mt-0.5 mb-2 flex items-center justify-center gap-2 rounded-3xl border px-5 py-2.5 shadow-md transition-all duration-200 ease-in-out hover:ring active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 {buttonClass} {additionalClass}"
    onclick={() => GameApiClient.generatePiece(actingPlayer, pieceType)}
    disabled={!canAfford || !isHumanTurn || isAutomationRunning || turn.winner !== null}
    aria-label={pieceTypeLabel(pieceType)}
  >
    <Icon icon={pieceType.config.iconName} size={20} />
    {#if !compact}
      <span>{pieceTypeLabel(pieceType)}</span>
    {/if}
  </button>
</div>
