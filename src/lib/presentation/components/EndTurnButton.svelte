<script lang="ts">
  import { GameApi } from "$lib/api/GameApi";
  import { TurnAndAiService } from "$lib/services/TurnAndAiService";
  import { TurnRepository } from "$lib/data/repositories/TurnRepository";
  import { SelectedPanelRepository } from "$lib/data/repositories/SelectedPanelRepository";
  import { Player } from "$lib/domain/enums/Player";
  import { m } from "$lib/paraglide/messages";
  import Icon from "$lib/presentation/components/Icon.svelte";

  let currentPlayer = $derived(TurnRepository.get().player);
  let isPlayerTurn = $derived(currentPlayer === Player.SELF);

  function handleEndTurn() {
    if (!isPlayerTurn) return;
    SelectedPanelRepository.set(undefined);
    const result = GameApi.endTurn(Player.SELF);
    if (result.ok && result.value.nextPlayer === Player.OPPONENT && !result.value.winner) {
      setTimeout(() => TurnAndAiService.doOpponentTurn(), 1000);
    }
  }
</script>

<button
  type="button"
  onclick={handleEndTurn}
  disabled={!isPlayerTurn}
  class="border-primary dark:border-primary-dark text-onbackground dark:text-onbackground-dark shadow-primary dark:shadow-primary-dark hover:ring-primary dark:hover:ring-primary-dark flex items-center gap-2 rounded-3xl border px-5 py-2.5 shadow-md transition-all duration-200 ease-in-out hover:ring active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
>
  <Icon icon="skip_next" size={24} />
  {m.end_turn()}
</button>
