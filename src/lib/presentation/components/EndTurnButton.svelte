<script lang="ts">
  import { GameApi } from "$lib/api/GameApi";
  import { TurnRepository } from "$lib/data/repositories/TurnRepository";
  import { SelectedPanelRepository } from "$lib/data/repositories/SelectedPanelRepository";
  import { m } from "$lib/paraglide/messages";
  import Icon from "$lib/presentation/components/Icon.svelte";
  import { MatchService } from "$lib/services/MatchService";

  let { compact = false, additionalClass = "" }: { compact?: boolean; additionalClass?: string } =
    $props();

  let turn = $derived(TurnRepository.get());
  let currentPlayer = $derived(turn.player);
  let isHumanTurn = $derived(MatchService.getControllerForCurrentTurn() === "human");
  let isAutomationRunning = $derived(MatchService.isAutomationRunning());
  let label = $derived(m.end_turn());
  let buttonClass = $derived(compact ? "h-11 w-11 rounded-2xl px-0" : "");

  function handleEndTurn() {
    if (!isHumanTurn || isAutomationRunning || turn.winner !== null) return;

    SelectedPanelRepository.set(undefined);

    const result = GameApi.endTurn(currentPlayer);
    if (!result.ok) return;

    MatchService.runAutomatedTurnsIfNeeded();
  }
</script>

<button
  type="button"
  onclick={handleEndTurn}
  disabled={!isHumanTurn || isAutomationRunning || turn.winner !== null}
  title={compact ? label : undefined}
  aria-label={label}
  class="border-primary dark:border-primary-dark text-onbackground dark:text-onbackground-dark shadow-primary dark:shadow-primary-dark hover:ring-primary dark:hover:ring-primary-dark mt-0.5 mb-2 flex items-center justify-center gap-2 rounded-3xl border px-5 py-2.5 shadow-md transition-all duration-200 ease-in-out hover:ring active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 {buttonClass} {additionalClass}"
>
  <Icon icon="skip_next" size={24} />
  {#if !compact}
    {label}
  {/if}
</button>
