<script>
  import { GameService } from "$lib/services/GameService";
  import LayeredHexagonPanels from "$lib/presentation/components/LayeredHexagonPanels.svelte";

  GameService.initialize({ layer: 5 });
</script>

<LayeredHexagonPanels />
