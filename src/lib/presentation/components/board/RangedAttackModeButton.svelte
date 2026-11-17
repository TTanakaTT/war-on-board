<script lang="ts">
  import { PiecesRepository } from "#lib/data/repositories/PieceRepository.ts";
  import { SelectedPanelRepository } from "#lib/data/repositories/SelectedPanelRepository.ts";
  import { RangedAttackModeRepository } from "#lib/data/repositories/RangedAttackModeRepository.ts";
  import { InteractionService } from "#lib/services/InteractionService.ts";
  import { MatchService } from "#lib/services/MatchService.ts";
  import { m } from "#lib/paraglide/messages.js";
  import Icon from "#lib/presentation/components/primitives/Icon.svelte";
  import AppButton from "#lib/presentation/components/primitives/AppButton.svelte";

  let selectedPieceId = $derived(SelectedPanelRepository.getPieceId());
  let selectedPiece = $derived(
    selectedPieceId !== undefined
      ? PiecesRepository.getAll().find((p) => p.id === selectedPieceId)
      : undefined,
  );
  let isHumanTurn = $derived(MatchService.getControllerForCurrentTurn() === "human");
  let isVisible = $derived(
    !!selectedPiece &&
      selectedPiece.attackRange > 1 &&
      isHumanTurn &&
      !MatchService.isAutomationRunning(),
  );
  let isActive = $derived(RangedAttackModeRepository.isActive());
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
