<script lang="ts">
  import {
    PanelRepository,
    PiecesRepository,
    SelectionRepository,
    TurnRepository,
  } from "#lib/store.svelte.ts";
  import {
    type PanelPosition,
    PanelState,
    type Piece,
    Player,
    samePos,
    Terrain,
    terrainConfig,
  } from "#lib/domain/model.ts";
  import { InteractionService } from "#lib/services/InteractionService.ts";
  import { MovementRulesService } from "#lib/services/MovementRulesService.ts";
  import { m } from "#lib/paraglide/messages.js";
  import {
    BoardLayout,
    getPanelRowPieces,
    TERRAIN_ICON_SIZE_PX,
  } from "#lib/presentation/layout.ts";
  import { terrainIconClass } from "#lib/presentation/terrain.ts";
  import Icon from "#lib/presentation/components/primitives/Icon.svelte";
  import HexagonPanelSvg from "./HexagonPanelSvg.svelte";
  import PieceToken from "./PieceToken.svelte";
  import { slide } from "svelte/transition";

  type PanelAppearance = {
    isInteractive: boolean;
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

  let selectedPieceId = $derived(SelectionRepository.getPieceId());
  let pieces = $derived(PiecesRepository.getPiecesByPosition(panelPosition));
  let rowPieces = $derived(getPanelRowPieces(panelPosition));

  let panel = $derived(PanelRepository.find(panelPosition));
  let player = $derived(panel?.player);
  let wall = $derived(panel?.wall);
  let resource = $derived(panel?.resource);

  let panelState = $derived(panel?.panelState);
  let terrain = $derived(panel?.terrain ?? Terrain.PLAIN);
  let terrainIconName = $derived(terrainConfig(terrain).iconName);
  let isPassable = $derived(terrainConfig(terrain).passable);

  let selectedPiece = $derived(PiecesRepository.get(selectedPieceId));
  // Targets beyond this turn's reach get a distinct color.
  let isDistantMovable = $derived(
    Boolean(
      selectedPiece &&
      !samePos(panelPosition, selectedPiece.panelPosition) &&
      !MovementRulesService.isWithinThisTurnsReach(selectedPiece, panelPosition),
    ),
  );
  let isRangedAttackTarget = $derived(
    Boolean(
      selectedPiece &&
      SelectionRepository.isRangedAttackMode() &&
      MovementRulesService.canRangedAttack(selectedPiece.id, panelPosition),
    ),
  );

  let panelAppearance = $derived(getPanelAppearance());
  let isInteractive = $derived(panelAppearance.isInteractive);
  let panelFrameStyle = $derived(
    `width: ${BoardLayout.horizontalSideLength}px; height: ${BoardLayout.HEIGHT}px;`,
  );
  let panelHitAreaStyle = $derived(
    `width: ${BoardLayout.horizontalSideLength * 2}px; height: ${BoardLayout.HEIGHT}px; clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%);`,
  );

  let turn = $derived(TurnRepository.get());

  let resourceColor = $derived(
    panel?.player === Player.SELF
      ? "text-player-self border-player-self"
      : "text-player-opponent border-player-opponent",
  );

  function handlePieceClick(e: MouseEvent, piece: Piece) {
    e.stopPropagation();
    InteractionService.pieceChange(piece);
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
        strokeClass = "stroke-2 stroke-player-self";
        strokeDasharray = PLAYER_PANEL_STROKE_DASHARRAY;
        break;
      case Player.OPPONENT:
        strokeClass = "stroke-2 stroke-player-opponent";
        strokeDasharray = PLAYER_PANEL_STROKE_DASHARRAY;
        break;
      default:
        strokeClass = "stroke-outline dark:stroke-outline-dark";
    }

    const baseContainerClass =
      "group relative mx-0 my-2.5 flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
    const basePolygonClass =
      "transition-all duration-400 ease-out group-hover:duration-200 group-hover:ease-out";

    if (!isPassable) {
      return {
        isInteractive: false,
        containerClass: `${baseContainerClass} pointer-events-none`,
        polygonClass: `${basePolygonClass} fill-panel-mountain dark:fill-panel-mountain-dark`,
        strokeClass,
        strokeDasharray,
      };
    }

    switch (_panelState) {
      case PanelState.UNOCCUPIED:
        return {
          isInteractive: false,
          containerClass: `${baseContainerClass} pointer-events-none`,
          polygonClass: `${basePolygonClass} fill-panel-unoccupied dark:fill-panel-unoccupied-dark`,
          strokeClass,
          strokeDasharray,
        };
      case PanelState.OCCUPIED:
        return {
          isInteractive: true,
          containerClass: baseContainerClass,
          polygonClass: `${basePolygonClass} fill-panel-occupied dark:fill-panel-occupied-dark`,
          strokeClass,
          strokeDasharray,
        };
      case PanelState.SELECTED:
      case PanelState.MOVABLE: {
        const movableFill = isRangedAttackTarget
          ? "fill-panel-ranged-target dark:fill-panel-ranged-target-dark"
          : isDistantMovable
            ? "fill-panel-movable-distant dark:fill-panel-movable-distant-dark"
            : "fill-panel-movable dark:fill-panel-movable-dark";
        return {
          isInteractive: true,
          containerClass: `${baseContainerClass} cursor-pointer`,
          polygonClass: `${basePolygonClass} ${movableFill} group-hover:fill-panel-selected dark:group-hover:fill-panel-selected-dark`,
          strokeClass,
          strokeDasharray,
        };
      }
      default:
        return {
          isInteractive: false,
          containerClass: `${baseContainerClass} pointer-events-none`,
          polygonClass: `${basePolygonClass} fill-panel-immovable dark:fill-panel-immovable-dark`,
          strokeClass,
          strokeDasharray,
        };
    }
  }
</script>

{#snippet panelContent()}
  <div
    class="absolute top-0 left-1/2 z-0 -translate-x-1/2 {isInteractive
      ? 'cursor-pointer'
      : 'pointer-events-none'}"
    style={panelHitAreaStyle}
    aria-hidden="true"
  ></div>

  {#if isInteractive}
    <button
      class="focus-visible:ring-primary absolute top-0 left-1/2 z-0 -translate-x-1/2 cursor-pointer focus-visible:ring-2 focus-visible:outline-none"
      style={panelHitAreaStyle}
      type="button"
      aria-label={m.aria_label_board_panel()}
      {onclick}
    ></button>
  {/if}

  <HexagonPanelSvg
    polygonClass={panelAppearance.polygonClass}
    strokeClass={panelAppearance.strokeClass}
    strokeDasharray={panelAppearance.strokeDasharray}
  />

  <div class="pointer-events-none absolute inset-0 z-1 flex rotate-90 flex-col lg:rotate-0">
    {#if terrainIconName}
      <div
        class="pointer-events-none absolute inset-0 -z-1 flex items-center justify-center {terrainIconClass(
          terrain,
        )} {isPassable ? 'opacity-40' : ''}"
      >
        <Icon icon={terrainIconName} size={TERRAIN_ICON_SIZE_PX} />
      </div>
    {/if}
    <div class="pointer-events-none flex flex-1 items-start">
      {#if wall && wall > 0}
        <div
          class="bg-wall flex items-center justify-center gap-0.5 rounded-lg border pr-1.5 pl-0.5 {resourceColor}"
        >
          <Icon
            icon="castle"
            size={12}
            transition={slide}
            transitionParams={{ duration: 500, axis: "y" }}
          />

          <div>{wall}</div>
        </div>
      {/if}
    </div>

    <div class="pointer-events-none z-1 flex items-center justify-center">
      <div class="flex flex-row gap-2">
        {#each rowPieces as piece (piece.id)}
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
            <PieceToken {piece} isSelected={piece.id === selectedPieceId} />
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
{/snippet}

<div class={panelAppearance.containerClass} style={panelFrameStyle}>
  {@render panelContent()}
</div>
