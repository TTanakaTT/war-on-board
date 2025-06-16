<script lang="ts">
	import HexagonPanel from './HexagonPanel.svelte';
	import { PanelPosition } from '$lib/domain/entities/PanelPosition';
	import { m } from '$lib/paraglide/messages';
	import { turnState } from '$lib/presentation/state/TurnState.svelte';
	import { GameService } from '$lib/domain/services/GameService';
	import { Player } from '$lib/domain/enums/Player';
	import { PieceType } from '$lib/domain/enums/PieceType';
	import { layerState } from '$lib/presentation/state/LayerState.svelte';
	import GeneratePieceButton from '$lib/presentation/components/GeneratePieceButton.svelte';

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
		turn.player === Player.SELF ? 'text-white border-white' : 'text-black border-black'
	);
</script>

<div class="my-2 flex justify-center gap-2">
	<GeneratePieceButton pieceType={PieceType.KNIGHT} />
	<GeneratePieceButton pieceType={PieceType.ROOK} />
	<GeneratePieceButton pieceType={PieceType.BISHOP} />
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
