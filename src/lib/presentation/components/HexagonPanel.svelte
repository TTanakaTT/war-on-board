<script lang="ts">
  import { PanelsService } from "$lib/services/PanelService";
  import { PiecesRepository } from "$lib/data/repositories/PieceRepository";
  import { InteractionService } from "$lib/services/InteractionService";
  import { TurnRepository } from "$lib/data/repositories/TurnRepository";

  import { PanelState } from "$lib/domain/enums/PanelState";
  import { Player } from "$lib/domain/enums/Player";
  import type { Piece } from "$lib/domain/entities/Piece";
  import type { PanelPosition } from "$lib/domain/entities/PanelPosition";
  import { BoardLayout } from "$lib/presentation/BoardLayout";
  import HexagonPanelSvg from "$lib/presentation/components/HexagonPanelSvg.svelte";
  import Icon from "$lib/presentation/components/Icon.svelte";
  import PieceToken from "$lib/presentation/components/PieceToken.svelte";
  import { slide } from "svelte/transition";

  type PanelAppearance = {
    containerClass: string;
    polygonClass: string;
    strokeClass: string;
    strokeDasharray?: string;
  };

  const PLAYER_PANEL_STROKE_DASHARRAY = "3 3";

  let {
    panelPosition,
    onclick,
  }: {
    panelPosition: PanelPosition;
    onclick: () => void;
  } = $props();

  let pieces = $derived(PiecesRepository.getPiecesByPosition(panelPosition));

  let panel = $derived(PanelsService.find(panelPosition));
  let player = $derived(panel?.player);
  let castle = $derived(panel?.castle);
  let resource = $derived(panel?.resource);

  let panelState = $derived(panel?.panelState);
  let panelAppearance = $derived(getPanelAppearance());
  let panelFrameStyle = $derived(
    `width: ${BoardLayout.horizontalSideLength}px; height: ${BoardLayout.HEIGHT}px;`,
  );

  let turn = $derived(TurnRepository.get());

  let resourceColor = $derived(
    panel?.player === Player.SELF ? "text-white border-white" : "text-black border-black",
  );

  function handlePieceClick(e: MouseEvent, piece: Piece) {
    e.stopPropagation();
    InteractionService.pieceChange(piece);
  }

  function onkeydown(e: KeyboardEvent) {
    if (!["Enter", " "].includes(e.key)) return;
    if (
      panelState &&
      ![PanelState.OCCUPIED, PanelState.SELECTED, PanelState.MOVABLE].includes(panelState)
    )
      return;

    if (pieces?.length === 0) return;

    onclick();
  }

  function getPanelAppearance(): PanelAppearance {
    let _panelState: PanelState;
    if (panelState) {
      _panelState = panelState;
    } else if (pieces?.length) {
      _panelState = PanelState.OCCUPIED;
    } else {
      _panelState = PanelState.UNOCCUPIED;
    }
    let strokeClass: string;
    let strokeDasharray: string | undefined;

    switch (player) {
      case Player.SELF:
        strokeClass = "stroke-2 stroke-white";
        strokeDasharray = PLAYER_PANEL_STROKE_DASHARRAY;
        break;
      case Player.OPPONENT:
        strokeClass = "stroke-2 stroke-black";
        strokeDasharray = PLAYER_PANEL_STROKE_DASHARRAY;
        break;
      default:
        strokeClass = "stroke-outline dark:stroke-outline-dark";
    }

    const baseContainerClass =
      "group relative mx-0 my-2.5 flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
    const basePolygonClass =
      "transition-all duration-400 ease-out group-hover:duration-200 group-hover:ease-out";

    switch (_panelState) {
      case PanelState.UNOCCUPIED:
        return {
          containerClass: `${baseContainerClass} pointer-events-none`,
          polygonClass: `${basePolygonClass} fill-panel-unoccupied dark:fill-panel-unoccupied-dark`,
          strokeClass,
          strokeDasharray,
        };
      case PanelState.OCCUPIED:
        return {
          containerClass: baseContainerClass,
          polygonClass: `${basePolygonClass} fill-panel-occupied dark:fill-panel-occupied-dark`,
          strokeClass,
          strokeDasharray,
        };
      case PanelState.SELECTED:
      case PanelState.MOVABLE:
        return {
          containerClass: `${baseContainerClass} cursor-pointer`,
          polygonClass: `${basePolygonClass} fill-panel-movable group-hover:fill-panel-selected dark:fill-panel-movable-dark dark:group-hover:fill-panel-selected-dark`,
          strokeClass,
          strokeDasharray,
        };
      case PanelState.IMMOVABLE:
      default:
        return {
          containerClass: `${baseContainerClass} pointer-events-none`,
          polygonClass: `${basePolygonClass} fill-panel-immovable dark:fill-panel-immovable-dark`,
          strokeClass,
          strokeDasharray,
        };
    }
  }
</script>

<div
  class={panelAppearance.containerClass}
  role="button"
  tabindex="0"
  style={panelFrameStyle}
  {onkeydown}
>
  <HexagonPanelSvg
    polygonClass={panelAppearance.polygonClass}
    strokeClass={panelAppearance.strokeClass}
    strokeDasharray={panelAppearance.strokeDasharray}
    onClick={onclick}
  />

  <div class="absolute inset-0 z-1 flex rotate-90 flex-col lg:rotate-0">
    <div class="pointer-events-none flex flex-1 items-start">
      {#if castle && castle > 0}
        <div
          class="bg-castle flex items-center justify-center gap-0.5 rounded-lg border pr-1.5 pl-0.5 {resourceColor}"
        >
          <Icon
            icon="castle"
            size={12}
            transition={slide}
            transitionParams={{ duration: 500, axis: "y" }}
          />

          <div>{castle}</div>
        </div>
      {/if}
    </div>

    <div class="pointer-events-none z-1 flex items-center justify-center">
      <div class="flex flex-row gap-2">
        {#each pieces as piece (piece.id)}
          <button
            class="pointer-events-auto relative flex flex-col items-center {piece.targetPosition
              ? 'opacity-40'
              : ''} {piece.player === turn.player ? 'cursor-pointer' : ''}"
            type="button"
            tabindex="0"
            onclick={(e) => handlePieceClick(e, piece)}
            onkeydown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                InteractionService.pieceChange(piece);
              }
            }}
          >
            <PieceToken {piece} />
          </button>
        {/each}
      </div>
    </div>

    <div class="pointer-events-none flex flex-1 items-end">
      {#if resource && resource > 0}
        <div
          class="bg-resource flex items-center justify-center gap-0.5 rounded-lg border pr-1.5 pl-0.5 {resourceColor}"
        >
          <Icon
            icon="home"
            size={12}
            transition={slide}
            transitionParams={{ duration: 500, axis: "y" }}
          />

          <div>{resource}</div>
        </div>
      {/if}
    </div>
  </div>
</div>
