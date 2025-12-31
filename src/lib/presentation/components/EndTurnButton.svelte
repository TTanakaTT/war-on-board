<script lang="ts">
  import { GameService } from "$lib/services/GameService";
  import { TurnRepository } from "$lib/data/repositories/TurnRepository";
  import { Player } from "$lib/domain/enums/Player";
  import { m } from "$lib/paraglide/messages";
  import SkipNext from "svelte-material-icons/SkipNext.svelte";

  let currentPlayer = $derived(TurnRepository.get().player);
  let isPlayerTurn = $derived(currentPlayer === Player.SELF);

  function handleEndTurn() {
    if (isPlayerTurn) {
      GameService.nextTurn();
    }
  }
</script>

<button
  type="button"
  onclick={handleEndTurn}
  disabled={!isPlayerTurn}
  class="border-primary dark:border-primary-dark text-onbackground dark:text-onbackground-dark shadow-primary dark:shadow-primary-dark hover:ring-primary dark:hover:ring-primary-dark flex items-center gap-2 rounded-3xl border px-5 py-2.5 shadow-md transition-all duration-200 ease-in-out hover:ring active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
>
  <SkipNext class="size-6" />
  {m.end_turn()}
</button>
