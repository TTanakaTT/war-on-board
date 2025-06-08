<script lang="ts">
	import HexagonPanel from './HexagonPanel.svelte';
	import { PanelPosition } from '$lib/domain/entities/PanelPosition';
	import { m } from '$lib/paraglide/messages';
	import { turnState } from '$lib/presentation/state/TurnState.svelte';
	import { GameService } from '$lib/domain/services/GameService';
	import { PLAYER } from '$lib/domain/enums/Player';
	import { layerState } from '$lib/presentation/state/LayerState.svelte';

	let turn = $derived(turnState.get());
	const layer = $derived(layerState.get());

	function sideRange(): number[] {
		const horizontalLayer = layer;
		const range = [];
		for (let i = -(horizontalLayer - 1); i < horizontalLayer; i++) {
			range.push(i);
		}
		return range;
	}

	function horizontalStyle(horizontalLayer: number): string {
		const height = 100;
		const left: number =
			((height * Math.sqrt(3)) / 2) * 1.1 * horizontalLayer -
			(height / Math.sqrt(3)) * (Number(layer) + horizontalLayer) +
			height / Math.sqrt(3) / 2;
		const top: number = Math.abs(horizontalLayer) * (height * 0.5) * 1.1;
		return `left: ${left.toString()}px; top: ${top.toString()}px`;
	}

	let turnColor = $derived(
		turn.player === PLAYER.SELF ? 'text-white border-white' : 'text-black border-black'
	);
</script>

<div class="flex justify-center">
	<button
		type="button"
		class="border-primary dark:border-primary-dark text-onbackground dark:text-onbackground-dark shadow-primary dark:shadow-primary-dark hove hover:ring-primary dark:hover:ring-primary-dark m-2 rounded-3xl border px-5 py-2.5 shadow-md transition-all duration-200 ease-in-out hover:ring active:translate-y-1 active:shadow-none"
		onclick={() => GameService.generate()}>{m.generate()}</button
	>
</div>
<div class="m-2 flex justify-center">
	<span
		class="bg-primary-variant dark:bg-primary-variant-dark rounded-xl border-2 p-1.5 text-sm {turnColor}"
		>turn<span class="text-2xl font-bold">{turn.num}</span> {turn.player}</span
	>
</div>
<div class="relative left-1/2">
	{#each sideRange() as hl (hl)}
		<div class="relative float-left" style={horizontalStyle(hl)}>
			{#each { length: layer - Math.abs(hl) }, vl}
				<div>
					<HexagonPanel
						panelPosition={new PanelPosition({
							horizontalLayer: hl,
							verticalLayer: vl
						})}
						onclick={() =>
							GameService.panelChange(
								new PanelPosition({
									horizontalLayer: hl,
									verticalLayer: vl
								})
							)}
					/>
				</div>
			{/each}
		</div>
	{/each}
</div>
