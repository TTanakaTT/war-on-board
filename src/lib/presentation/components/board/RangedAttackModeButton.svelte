<script lang="ts">
  import { pieceConfig } from "#lib/domain/model.ts";
  import { PiecesRepository, SelectionRepository } from "#lib/store.svelte.ts";
  import { InteractionService } from "#lib/services/InteractionService.ts";
  import { MatchService } from "#lib/services/MatchService.ts";
  import { m } from "#lib/paraglide/messages.js";
  import Icon from "#lib/presentation/components/primitives/Icon.svelte";
  import AppButton from "#lib/presentation/components/primitives/AppButton.svelte";

  let selectedPiece = $derived(PiecesRepository.get(SelectionRepository.getPieceId()));
  let isHumanTurn = $derived(MatchService.getControllerForCurrentTurn() === "human");
  let isVisible = $derived(
    !!selectedPiece &&
      pieceConfig(selectedPiece.pieceType).attackRange > 1 &&
      isHumanTurn &&
      !MatchService.isAutomationRunning(),
  );
  let isActive = $derived(SelectionRepository.isRangedAttackMode());
  let label = $derived(isActive ? m.ranged_attack_cancel() : m.ranged_attack_start());
</script>

{#if isVisible}
  <div class="pointer-events-none absolute bottom-4 left-1/2 z-30 -translate-x-1/2">
    <div class="pointer-events-auto">
      <AppButton
        variant={isActive ? "error" : "primary"}
        onclick={() => InteractionService.toggleRangedAttackMode()}
      >
        <Icon icon="target" size={20} />
        <span>{label}</span>
      </AppButton>
    </div>
  </div>
{/if}
