<svelte:options customElement="hexagon-panel" />

<script lang="ts">
	import { PanelsService } from '$lib/data/services/PanelService';
	import { PiecesRepository } from '$lib/data/repositories/PieceRepository';

	import { PanelState } from '$lib/domain/enums/PanelState';
	import { slide } from 'svelte/transition';
	import { Player } from '$lib/domain/enums/Player';
	import type { PanelPosition } from '$lib/domain/entities/PanelPosition';

	let {
		panelPosition,
		onclick
	}: {
		panelPosition: PanelPosition;
		onclick: () => void;
	} = $props();

	let pieces = $derived(PiecesRepository.getPiecesByPosition(panelPosition));

	let panelState = $derived(PanelsService.findPanelState(panelPosition));
	let panelStyle = $derived(getPanelStyle());
	let pieceColor = $derived(
		pieces[0]?.player === Player.SELF ? 'text-white border-white' : 'text-black border-black'
	);

	function onkeydown(e: KeyboardEvent) {
		if (!['Enter', ' '].includes(e.key)) return;
		if (
			panelState &&
			![PanelState.OCCUPIED, PanelState.SELECTED, PanelState.MOVABLE].includes(panelState)
		)
			return;

		if (pieces?.length === 0) return;

		onclick();
	}

	function getPanelStyle(): string {
		let _panelState: PanelState;
		if (panelState) {
			_panelState = panelState;
		} else if (pieces?.length) {
			_panelState = PanelState.OCCUPIED;
		} else {
			_panelState = PanelState.UNOCCUPIED;
		}
		let hoverStyle = 'hover:all-el:bg-panel-selected dark:hover:all-el:bg-panel-selected-dark';
		switch (_panelState) {
			case PanelState.UNOCCUPIED:
				return 'pointer-events-none all-el:bg-panel-unoccupied dark:all-el:bg-panel-unoccupied-dark';
			case PanelState.OCCUPIED:
				return `cursor-pointer ${hoverStyle} all-el:bg-panel-occupied dark:all-el:bg-panel-occupied-dark`;
			case PanelState.SELECTED:
			case PanelState.MOVABLE:
				return `cursor-pointer ${hoverStyle} all-el:bg-panel-movable dark:all-el:bg-panel-movable-dark`;
			case PanelState.IMMOVABLE:
			default:
				return 'pointer-events-none all-el:bg-panel-immovable dark:all-el:bg-panel-immovable-dark';
		}
	}
</script>

<div
	class="pseudo-el:content-[''] all-el:border-y all-el:border-outline dark:all-el:border-outline-dark all-el:transition-all all-el:duration-400 all-el:ease-out hover:all-el:transition-all hover:all-el:duration-200 hover:all-el:ease-out pseudo-el:-top-px pseudo-el:absolute all-el:h-[100px] all-el:w-[calc(100px/1.73)] relative mx-0 my-[calc(100px*0.1)] flex items-center justify-center before:rotate-60 after:-rotate-60 {panelStyle}"
	role="button"
	tabindex="0"
	{onclick}
	{onkeydown}
>
	<!-- <div
		class="text-secondary t-0 absolute inset-0 z-1000 flex-row justify-center text-center text-xs"
	>
		<p>
			{panelState}
		</p>
		<p>
			{panelPosition.horizontalLayer}, {panelPosition.verticalLayer}
		</p>
	</div> -->
	{#each pieces as piece (piece.id)}
		{#snippet icon()}
			{@const Icon = piece.pieceType.getComponent()}
			<Icon
				class="bg-primary-variant dark:bg-primary-variant-dark size-9 rounded-xl border p-1.5 {pieceColor}"
			/>
		{/snippet}

		<i class="z-1" transition:slide={{ duration: 500, axis: 'y' }}>
			{@render icon()}
		</i>
	{/each}
</div>
