<script>
	import { GameService } from '$lib/domain/services/GameService';
	import LayeredHexagonPanels from './LayeredHexagonPanels.svelte';

	GameService.initialize({ layer: 5 });
</script>

<LayeredHexagonPanels />
