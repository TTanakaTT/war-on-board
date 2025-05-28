<svelte:options customElement="hexagon-panel" />

<script lang="ts">
	import ChessKnight from 'svelte-material-icons/ChessKnight.svelte';

	import { type PanelState, PANELSTATE } from '$lib/enums/PanelStates';
	import { panelsStore } from '$lib/store/PanelsStore';
	import { piecesStore } from '$lib/store/PiecesStore';
	import type { Readable } from 'svelte/store';
	import { slide } from 'svelte/transition';

	let { horizontalLayer, verticalLayer, onclick } = $props();
	function onkeydown(e: KeyboardEvent) {
		if (!['Enter', ' '].includes(e.key)) return;
		if ($panelStates?.length) {
			if (![PANELSTATE.OCCUPIED, PANELSTATE.SELECTED, PANELSTATE.MOVABLE].includes($panelStates[0]))
				return;
		} else if ($pieceNames?.length === 0) return;

		onclick();
	}

	let pieceNames: Readable<string[]> = piecesStore.getPieceNames(horizontalLayer, verticalLayer);
	let panelStates: Readable<PanelState[]> = panelsStore.getPanelStates(
		horizontalLayer,
		verticalLayer
	);
	let panelStyle = $derived(getPanelStyle());

	function getPanelStyle(): string {
		let panelState: PanelState;
		if ($panelStates?.length) {
			panelState = $panelStates[0];
		} else if ($pieceNames?.length) {
			panelState = PANELSTATE.OCCUPIED;
		} else {
			panelState = PANELSTATE.UNOCCUPIED;
		}
		let hoverStyle = 'hover:all-el:bg-panel-selected dark:hover:all-el:bg-panel-selected-dark';
		switch (panelState) {
			case PANELSTATE.UNOCCUPIED:
				return 'pointer-events-none all-el:bg-panel-unoccupied dark:all-el:bg-panel-unoccupied-dark';
			case PANELSTATE.OCCUPIED:
				return `cursor-pointer ${hoverStyle} all-el:bg-panel-occupied dark:all-el:bg-panel-occupied-dark`;
			case PANELSTATE.SELECTED:
			case PANELSTATE.MOVABLE:
				return `cursor-pointer ${hoverStyle} all-el:bg-panel-movable dark:all-el:bg-panel-movable-dark`;
			case PANELSTATE.IMMOVABLE:
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
	{#each $pieceNames as pieceName (pieceName)}
		<i class="z-1" transition:slide={{ duration: 500, axis: 'y' }}>
			<ChessKnight
				class="bg-primary-variant dark:bg-primary-variant-dark size-9 rounded-xl border border-white p-1.5 text-white"
			/>
		</i>
	{/each}
</div>
