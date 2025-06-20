<script lang="ts">
	import HexagonPanel from './HexagonPanel.svelte';
	import { PanelPosition } from '$lib/domain/entities/PanelPosition';
	import { turnState } from '$lib/presentation/state/TurnState.svelte';
	import { GameService } from '$lib/domain/services/GameService';
	import { Player } from '$lib/domain/enums/Player';
	import { PieceType } from '$lib/domain/enums/PieceType';
	import { layerState } from '$lib/presentation/state/LayerState.svelte';
	import GeneratePieceButton from '$lib/presentation/components/GeneratePieceButton.svelte';

	let turn = $derived(turnState.get());
	const layer = layerState.get();

	function sideRange(): number[] {
		const horizontalLayer = layer;
		const range = [];
		for (let i = -(horizontalLayer - 1); i < horizontalLayer; i++) {
			range.push(i);
		}
		return range;
	}

	const height = 100;

	const horizontalSideLength = height / Math.sqrt(3);
	const hypotenuseHorizontalLength = height / 2 / Math.sqrt(3);
	const horizontalLength = horizontalSideLength + hypotenuseHorizontalLength;
	const horizontalMargin = (height * 0.1 * Math.sqrt(3)) / 2;

	const width =
		horizontalLength * (layer * 2 - 1) +
		horizontalMargin * (layer * 2 - 2) +
		hypotenuseHorizontalLength;
	const layeredPanelWidthStyle = `width: ${width.toString()}px; `;

	function panelPositionStyle(horizontalLayer: number): string {
		const left =
			hypotenuseHorizontalLength * (layer + horizontalLayer) +
			horizontalMargin * (layer + horizontalLayer - 1);
		const top = Math.abs(horizontalLayer) * (height / 2) * 1.1;
		return `left: ${left.toString()}px; top: ${top.toString()}px`;
	}

	let turnColor = $derived(
		turn.player === Player.SELF ? 'text-white border-white' : 'text-black border-black'
	);
</script>

<div class="m-2 flex justify-center">
	<span
		class="bg-primary-variant dark:bg-primary-variant-dark rounded-xl border-2 p-1.5 text-sm {turnColor}"
		>turn<span class="text-2xl font-bold">{turn.num}</span> {turn.player}</span
	>
</div>
<div class="m-2 flex justify-center">
	<div style={layeredPanelWidthStyle}>
		{#each sideRange() as hl (hl)}
			<div class="relative float-left" style={panelPositionStyle(hl)}>
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
</div>

<div class="my-2 flex justify-center gap-2">
	<GeneratePieceButton pieceType={PieceType.KNIGHT} />
	<GeneratePieceButton pieceType={PieceType.ROOK} />
	<GeneratePieceButton pieceType={PieceType.BISHOP} />
</div>
