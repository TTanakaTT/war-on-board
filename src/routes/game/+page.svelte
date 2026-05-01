<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { GameApi } from "$lib/api/GameApi";
  import GameDialogModal from "$lib/presentation/components/GameDialogModal.svelte";
  import LayeredHexagonPanels from "$lib/presentation/components/LayeredHexagonPanels.svelte";

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
  <LayeredHexagonPanels />
  <GameDialogModal />
{/if}
