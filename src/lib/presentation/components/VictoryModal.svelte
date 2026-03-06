<script lang="ts">
  import { TurnRepository } from "$lib/data/repositories/TurnRepository";
  import { Player } from "$lib/domain/enums/Player";
  import { m } from "$lib/paraglide/messages";

  let turn = $derived(TurnRepository.get());
  let isVictory = $derived(turn.winner === Player.SELF);
  let isDefeat = $derived(turn.winner === Player.OPPONENT);
  let showModal = $derived(turn.winner !== null);
</script>

{#if showModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
    <div
      class="bg-surface dark:bg-surface-dark flex min-w-72 flex-col items-center gap-4 rounded-2xl p-8 shadow-2xl"
    >
      {#if isVictory}
        <span class="material-symbols-outlined text-primary dark:text-primary-dark text-6xl">
          emoji_events
        </span>
        <h2 class="text-primary dark:text-primary-dark text-3xl font-bold">
          {m.victory_title()}
        </h2>
        <p class="text-onsurface dark:text-onsurface-dark text-lg">
          {m.victory_message()}
        </p>
      {:else if isDefeat}
        <span class="material-symbols-outlined text-error dark:text-error-dark text-6xl">
          heart_broken
        </span>
        <h2 class="text-error dark:text-error-dark text-3xl font-bold">
          {m.defeat_title()}
        </h2>
        <p class="text-onsurface dark:text-onsurface-dark text-lg">
          {m.defeat_message()}
        </p>
      {/if}
    </div>
  </div>
{/if}
