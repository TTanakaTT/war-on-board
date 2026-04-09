<script>
  import { GameApi } from "$lib/api/GameApi";
  import LayeredHexagonPanels from "$lib/presentation/components/LayeredHexagonPanels.svelte";
  import VictoryModal from "$lib/presentation/components/VictoryModal.svelte";

  GameApi.initializeGame({ layer: 5 });
</script>

<LayeredHexagonPanels />
<VictoryModal />
