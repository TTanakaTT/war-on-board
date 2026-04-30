<script lang="ts">
  import { onMount } from "svelte";
  import {
    DEFAULT_AUTOMATION_TURN_LIMIT,
    DEFAULT_GAME_LAYER,
  } from "$lib/domain/constants/GameConstants";
  import { AiStrength } from "$lib/domain/enums/AiStrength";
  import LayeredHexagonPanels from "$lib/presentation/components/LayeredHexagonPanels.svelte";
  import VictoryModal from "$lib/presentation/components/VictoryModal.svelte";
  import { MatchService } from "$lib/services/MatchService";

  onMount(() => {
    MatchService.startMatch("human-vs-cpu", {
      layer: DEFAULT_GAME_LAYER,
      automationTurnLimit: DEFAULT_AUTOMATION_TURN_LIMIT,
      aiStrengths: {
        self: AiStrength.STRENGTH_1,
        opponent: AiStrength.STRENGTH_1,
      },
    });
  });
</script>

<LayeredHexagonPanels />
<VictoryModal />
