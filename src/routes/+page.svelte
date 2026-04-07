<script>
  import { GameService } from "$lib/services/GameService";
  import LayeredHexagonPanels from "$lib/presentation/components/LayeredHexagonPanels.svelte";
  import VictoryModal from "$lib/presentation/components/VictoryModal.svelte";

  GameService.initialize({ layer: 5 });
</script>

<LayeredHexagonPanels />
<VictoryModal />
