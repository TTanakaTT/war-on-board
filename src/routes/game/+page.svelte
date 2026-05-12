<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { GameApi } from "$lib/api/GameApi";
  import GameBoard from "$lib/presentation/components/board/GameBoard.svelte";
  import GameDialogModal from "$lib/presentation/components/match/GameDialogModal.svelte";

  let isReady = $state(false);

  onMount(async () => {
    if (GameApi.getGameStateHistory().length === 0) {
      await goto(resolve("/"));
      return;
    }

    isReady = true;
  });
</script>

{#if isReady}
  <GameBoard />
  <GameDialogModal />
{/if}
