<script lang="ts">
  import { tick } from "svelte";
  import { page } from "$app/state";
  import { GameApi } from "$lib/api/GameApi";
  import { GameDialogRepository } from "$lib/data/repositories/GameDialogRepository";
  import { MatchControlRepository } from "$lib/data/repositories/MatchControlRepository";
  import { TurnRepository } from "$lib/data/repositories/TurnRepository";
  import { Player } from "$lib/domain/enums/Player";
  import { PieceType } from "$lib/domain/enums/PieceType";
  import { m } from "$lib/paraglide/messages";
  import AppButton from "$lib/presentation/components/AppButton.svelte";
  import EndTurnButton from "$lib/presentation/components/EndTurnButton.svelte";
  import GeneratePieceButton from "$lib/presentation/components/GeneratePieceButton.svelte";
  import Icon from "$lib/presentation/components/Icon.svelte";
  import IconButton from "$lib/presentation/components/IconButton.svelte";
  import PlayerIdentityBadge from "$lib/presentation/components/PlayerIdentityBadge.svelte";
  import { DESKTOP_NAVIGATION_BREAKPOINT_PX } from "$lib/presentation/constants/UiConstants";
  import { playerDisplayName } from "$lib/presentation/matchPresentation";
  import { MatchService } from "$lib/services/MatchService";

  let {
    open,
    isNav,
    onClickMenu,
    drawerWidthUnits,
  }: {
    open: boolean;
    isNav: boolean;
    onClickMenu: () => void;
    drawerWidthUnits: number;
  } = $props();

  let headerWidthStyle = $derived.by(() => {
    if (!isNav || !open) {
      return "width: 100vw;";
    }

    return `margin-left: calc(var(--spacing) * ${drawerWidthUnits}); width: calc(100vw - (var(--spacing) * ${drawerWidthUnits}));`;
  });

  let isGamePage = $derived(page.route.id === "/game");
  let matchControl = $derived(MatchControlRepository.get());
  let turn = $derived(TurnRepository.get());
  let selfResources = $derived(turn.resources.self ?? 0);
  let opponentResources = $derived(turn.resources.opponent ?? 0);
  let isHumanTurn = $derived(isGamePage && MatchService.getControllerForCurrentTurn() === "human");
  let isAutomationRunning = $derived(isGamePage && MatchService.isAutomationRunning());
  let generationMode = $derived(turn.generationMode[String(turn.player)] ?? "rear");
  let windowWidth = $state(0);
  let selfLabel = $derived(
    playerDisplayName("self", matchControl.controllers, matchControl.aiStrengths),
  );
  let opponentLabel = $derived(
    playerDisplayName("opponent", matchControl.controllers, matchControl.aiStrengths),
  );
  let generationModeLabel = $derived(
    generationMode === "rear" ? m.generation_rear() : m.generation_front(),
  );
  let isRotatedBoardLayout = $derived(
    isGamePage && windowWidth > 0 && windowWidth <= DESKTOP_NAVIGATION_BREAKPOINT_PX,
  );
  let generationModeIcon = $derived.by(() => {
    if (isRotatedBoardLayout) {
      return generationMode === "rear" ? "arrow_downward" : "arrow_upward";
    }

    return generationMode === "rear" ? "arrow_back" : "arrow_forward";
  });
  const generateMenuPieceTypes = [PieceType.KNIGHT, PieceType.ROOK, PieceType.BISHOP] as const;
  let controlsViewport = $state<HTMLDivElement | undefined>(undefined);
  let measurementStrip = $state<HTMLDivElement | undefined>(undefined);
  let isHeaderCompact = $state(false);

  let hoveredGenerationCost = $state<number | undefined>(undefined);
  let isGenerateMenuOpen = $state(false);

  function toggleGenerationMode(): void {
    if (!isHumanTurn || isAutomationRunning || turn.winner !== null) {
      return;
    }

    const currentMode = turn.generationMode[String(turn.player)] ?? "rear";
    GameApi.setGenerationMode(turn.player, currentMode === "rear" ? "front" : "rear");
  }

  function openLeaveDialog(): void {
    GameDialogRepository.requestLeaveDialog();
  }

  async function updateHeaderCompactMode(): Promise<void> {
    await tick();

    if (!isGamePage || !controlsViewport || !measurementStrip) {
      isHeaderCompact = false;
      return;
    }

    isHeaderCompact = measurementStrip.scrollWidth > controlsViewport.clientWidth;
  }

  function toggleGenerateMenu(): void {
    isGenerateMenuOpen = !isGenerateMenuOpen;
  }

  function handleGenerationCostPreview(previewCost: number | undefined): void {
    hoveredGenerationCost = previewCost;
  }

  $effect(() => {
    void isGamePage;
    void controlsViewport;
    void measurementStrip;

    if (!isGamePage || !controlsViewport || !measurementStrip) {
      isHeaderCompact = false;
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      void updateHeaderCompactMode();
    });

    resizeObserver.observe(controlsViewport);
    resizeObserver.observe(measurementStrip);
    void updateHeaderCompactMode();

    return () => {
      resizeObserver.disconnect();
    };
  });

  $effect(() => {
    void selfLabel;
    void opponentLabel;
    void selfResources;
    void opponentResources;
    void generationModeLabel;
    void hoveredGenerationCost;
    void drawerWidthUnits;

    void updateHeaderCompactMode();
  });

  $effect(() => {
    const gamePage = isGamePage;

    if (!gamePage) {
      isGenerateMenuOpen = false;
    }
  });
</script>

<svelte:window bind:innerWidth={windowWidth} />

{#snippet desktopGameControls(compact: boolean)}
  <EndTurnButton {compact} />

  <PlayerIdentityBadge
    player="self"
    label={selfLabel}
    resource={selfResources}
    {compact}
    previewCost={turn.player === Player.SELF ? hoveredGenerationCost : undefined}
  />

  <div title={compact ? generationModeLabel : undefined} aria-label={generationModeLabel}>
    <AppButton
      additionalClass={compact ? "h-11 w-11 rounded-2xl px-0" : "px-4"}
      onclick={toggleGenerationMode}
      disabled={!isHumanTurn || isAutomationRunning || turn.winner !== null}
    >
      <Icon icon={generationModeIcon} size={20} />
      {#if !compact}
        <span>{generationModeLabel}</span>
      {/if}
    </AppButton>
  </div>

  <GeneratePieceButton
    pieceType={PieceType.KNIGHT}
    {compact}
    onPreviewChange={handleGenerationCostPreview}
  />
  <GeneratePieceButton
    pieceType={PieceType.ROOK}
    {compact}
    onPreviewChange={handleGenerationCostPreview}
  />
  <GeneratePieceButton
    pieceType={PieceType.BISHOP}
    {compact}
    onPreviewChange={handleGenerationCostPreview}
  />

  <PlayerIdentityBadge
    player="opponent"
    label={opponentLabel}
    resource={opponentResources}
    {compact}
    previewCost={turn.player === Player.OPPONENT ? hoveredGenerationCost : undefined}
  />

  <IconButton icon="exit_to_app" label={m.leave_match()} onclick={openLeaveDialog} />
{/snippet}

<header
  class="bg-surface dark:bg-surface-dark border-outline dark:border-outline-dark fixed inset-s-0 top-0 z-20 border-b shadow-md transition-[margin-left,width] duration-200 ease-out"
  style={headerWidthStyle}
>
  <div class="hidden items-center gap-3 px-4 py-1 lg:flex">
    <IconButton icon="menu" label={m.drawer_title()} onclick={onClickMenu} />

    {#if isGamePage}
      <div class="flex-1">
        <div
          bind:this={measurementStrip}
          class="pointer-events-none invisible absolute top-0 right-0"
          aria-hidden="true"
        >
          <div
            class="text-onsurface dark:text-onsurface-dark flex flex-nowrap items-center justify-end gap-2 whitespace-nowrap"
          >
            {@render desktopGameControls(false)}
          </div>
        </div>

        <div
          bind:this={controlsViewport}
          class="text-onsurface dark:text-onsurface-dark flex flex-nowrap items-center justify-end gap-2 overflow-x-hidden"
        >
          {@render desktopGameControls(isHeaderCompact)}
        </div>
      </div>
    {/if}
  </div>

  <div
    class={isGamePage
      ? "relative min-h-28 overflow-visible px-2 py-1 lg:hidden"
      : "flex h-16 items-center px-2 py-1 lg:hidden"}
  >
    {#if isGamePage}
      <div class="absolute top-1/2 left-1 -translate-y-1/2">
        <IconButton icon="menu" label={m.drawer_title()} onclick={onClickMenu} />
      </div>

      <div class="absolute top-1/2 right-1 -translate-y-1/2">
        <IconButton icon="exit_to_app" label={m.leave_match()} onclick={openLeaveDialog} />
      </div>

      <div class="flex min-h-26 flex-col items-start gap-1 px-12 py-1">
        <div class="relative flex items-center gap-2">
          <PlayerIdentityBadge
            player="opponent"
            label={opponentLabel}
            resource={opponentResources}
            compact={true}
            previewCost={turn.player === Player.OPPONENT ? hoveredGenerationCost : undefined}
            additionalClass="h-10 w-fit min-w-0 px-2 py-1"
          />

          <AppButton
            additionalClass="mt-0 mb-0 h-10 w-10 shrink-0 rounded-2xl px-0"
            onclick={toggleGenerateMenu}
            variant="primary"
          >
            <Icon icon={generateMenuPieceTypes[0].config.iconName} size={20} />
            <span class="sr-only">{m.produce()}</span>
          </AppButton>

          {#if isGenerateMenuOpen}
            <div class="pointer-events-none absolute top-0 left-[calc(100%+0.5rem)] z-30">
              <div
                class="bg-surface/95 dark:bg-surface-dark/95 border-outline dark:border-outline-dark pointer-events-auto w-max max-w-[calc(100vw-12rem)] rounded-2xl border px-2 py-2 shadow-lg backdrop-blur-sm"
              >
                <div class="flex flex-wrap items-center justify-start gap-2">
                  {#each generateMenuPieceTypes as pieceType (pieceType.config.iconName)}
                    <GeneratePieceButton
                      {pieceType}
                      compact={true}
                      onPreviewChange={handleGenerationCostPreview}
                      additionalClass="mt-0 mb-0 h-10 w-10 rounded-2xl px-0 py-0"
                    />
                  {/each}
                </div>
              </div>
            </div>
          {/if}
        </div>

        <div class="grid grid-cols-[auto_auto_auto] items-center justify-start gap-2">
          <PlayerIdentityBadge
            player="self"
            label={selfLabel}
            resource={selfResources}
            compact={true}
            previewCost={turn.player === Player.SELF ? hoveredGenerationCost : undefined}
            additionalClass="h-10 w-fit min-w-0 px-2 py-1"
          />

          <EndTurnButton
            compact={true}
            additionalClass="mt-0 mb-0 h-10 w-10 rounded-2xl px-0 py-0"
          />

          <div title={generationModeLabel} aria-label={generationModeLabel}>
            <AppButton
              additionalClass="mt-0 mb-0 h-10 w-10 rounded-2xl px-0 py-0"
              onclick={toggleGenerationMode}
              disabled={!isHumanTurn || isAutomationRunning || turn.winner !== null}
            >
              <Icon icon={generationModeIcon} size={20} />
              <span class="sr-only">{generationModeLabel}</span>
            </AppButton>
          </div>
        </div>
      </div>
    {:else}
      <div class="flex w-full items-center justify-between">
        <IconButton icon="menu" label={m.drawer_title()} onclick={onClickMenu} />
      </div>
    {/if}
  </div>
</header>
