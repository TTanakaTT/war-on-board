<script lang="ts">
	import HexagonPanel from './HexagonPanel.svelte';
	import type { Piece } from '$lib/interfaces/Piece';
	import type { Panel } from '$lib/interfaces/Panel';
	import { type PanelState, PANELSTATE } from '$lib/enums/PanelStates';
	import { panelsStore } from '$lib/store/PanelsStore';
	import { piecesStore } from '$lib/store/PiecesStore';
	import { get, type Readable } from 'svelte/store';
	import { m } from '$lib/paraglide/messages';

	let { layer } = $props();

	let selectedPanel: Panel = {
		horizontalLayer: 1,
		verticalLayer: 1,
		panelState: PANELSTATE.SELECTED
	};

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
	function generate(): void {
		pieceChange(-(layer - 1), 0);
	}
	function panelChange(horizontalLayer: number, verticalLayer: number): void {
		const panelState: PanelState = getState(horizontalLayer, verticalLayer);
		stateChange(horizontalLayer, verticalLayer);
		switch (panelState) {
			case undefined:
				selectedPanel = {
					horizontalLayer: horizontalLayer,
					verticalLayer: verticalLayer,
					panelState: PANELSTATE.UNOCCUPIED
				};
				break;
			case PANELSTATE.MOVABLE:
				pieceChange(selectedPanel.horizontalLayer, selectedPanel.verticalLayer);
				pieceChange(horizontalLayer, verticalLayer);
				break;
		}
	}
	function stateChange(horizontalLayer: number, verticalLayer: number): void {
		const panelState: PanelState = getState(horizontalLayer, verticalLayer);
		let panel: Panel;
		switch (panelState) {
			case PANELSTATE.UNOCCUPIED:
				panel = {
					horizontalLayer: horizontalLayer,
					verticalLayer: verticalLayer,
					panelState: PANELSTATE.SELECTED
				};
				break;
			case PANELSTATE.SELECTED:
			case PANELSTATE.MOVABLE:
				panel = selectedPanel;
				break;
			default:
				panel = {
					horizontalLayer: horizontalLayer,
					verticalLayer: verticalLayer,
					panelState: PANELSTATE.SELECTED
				};
		}
		panelsStore.update(panel);
	}
	function pieceChange(horizontalLayer: number, verticalLayer: number): void {
		const pieceNames: Readable<string[]> = getPieceNames(horizontalLayer, verticalLayer);
		const isDelete: boolean = get(pieceNames).length > 0;

		const pieceName: string = isDelete ? get(pieceNames)[0] : 'knight';

		const piece: Piece = {
			horizontalLayer: horizontalLayer,
			verticalLayer: verticalLayer,
			pieceName: pieceName
		};
		if (isDelete) {
			piecesStore.remove(piece);
		} else {
			piecesStore.create(piece);
		}
	}
	function getPieceNames(horizontalLayer: number, verticalLayer: number): Readable<string[]> {
		return piecesStore.getPieceNames(horizontalLayer, verticalLayer);
	}
	function getState(horizontalLayer: number, verticalLayer: number): PanelState {
		return get(panelsStore.getPanelStates(horizontalLayer, verticalLayer))[0];
	}
</script>

<div class="flex justify-center">
	<button
		type="button"
		class="border-primary dark:border-primary-dark text-onbackground dark:text-onbackground-dark shadow-primary dark:shadow-primary-dark hove hover:ring-primary dark:hover:ring-primary-dark my-2 me-2 mb-2 rounded-3xl border px-5 py-2.5 shadow-md transition-all duration-200 ease-in-out hover:ring active:translate-y-1 active:shadow-none"
		onclick={() => generate()}>{m.generate()}</button
	>
</div>
<div class="relative left-1/2">
	{#each sideRange() as hl (hl)}
		<div class="relative float-left" style={horizontalStyle(hl)}>
			{#each { length: layer - Math.abs(hl) }, vl}
				<div>
					<HexagonPanel
						horizontalLayer={hl}
						verticalLayer={vl}
						onclick={() => panelChange(hl, vl)}
					/>
				</div>
			{/each}
		</div>
	{/each}
</div>
