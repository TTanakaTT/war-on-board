<script lang="ts">
  import type { Player } from "$lib/domain/enums/Player";
  import { Player as PlayerEnum } from "$lib/domain/enums/Player";
  import { PieceType } from "$lib/domain/enums/PieceType";
  import { m } from "$lib/paraglide/messages";
  import AppButton from "$lib/presentation/components/AppButton.svelte";
  import EndTurnButton from "$lib/presentation/components/EndTurnButton.svelte";
  import GeneratePieceButton from "$lib/presentation/components/GeneratePieceButton.svelte";
  import Icon from "$lib/presentation/components/Icon.svelte";
  import IconButton from "$lib/presentation/components/IconButton.svelte";
  import PlayerIdentityBadge from "$lib/presentation/components/PlayerIdentityBadge.svelte";

  let {
    opponentLabel,
    opponentResources,
    selfLabel,
    selfResources,
    currentPlayer,
    hoveredGenerationCost,
    generationModeLabel,
    generationModeIcon,
    isGenerateMenuOpen,
    generateMenuPieceTypes,
    isHumanTurn,
    isAutomationRunning,
    winner,
    onClickMenu,
    onOpenLeaveDialog,
    onToggleGenerateMenu,
    onToggleGenerationMode,
    onPreviewChange,
  }: {
    opponentLabel: string;
    opponentResources: number;
    selfLabel: string;
    selfResources: number;
    currentPlayer: Player;
    hoveredGenerationCost: number | undefined;
    generationModeLabel: string;
    generationModeIcon: string;
    isGenerateMenuOpen: boolean;
    generateMenuPieceTypes: readonly [PieceType, PieceType, PieceType];
    isHumanTurn: boolean;
    isAutomationRunning: boolean;
    winner: Player | null;
    onClickMenu: () => void;
    onOpenLeaveDialog: () => void;
    onToggleGenerateMenu: () => void;
    onToggleGenerationMode: () => void;
    onPreviewChange: (previewCost: number | undefined) => void;
  } = $props();
</script>

<div class="absolute top-1/2 left-1 -translate-y-1/2">
  <IconButton icon="menu" label={m.drawer_title()} onclick={onClickMenu} />
</div>

<div class="absolute top-1/2 right-1 -translate-y-1/2">
  <IconButton icon="exit_to_app" label={m.leave_match()} onclick={onOpenLeaveDialog} />
</div>

<div class="flex min-h-26 flex-col items-start gap-1 px-12 py-1">
  <div class="relative flex items-center gap-2">
    <PlayerIdentityBadge
      player="opponent"
      label={opponentLabel}
      resource={opponentResources}
      compact={true}
      previewCost={currentPlayer === PlayerEnum.OPPONENT ? hoveredGenerationCost : undefined}
      additionalClass="h-10 w-fit min-w-0 px-2 py-1"
    />

    <AppButton
      additionalClass="mt-0 mb-0 h-10 w-10 shrink-0 rounded-2xl px-0"
      onclick={onToggleGenerateMenu}
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
                {onPreviewChange}
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
      previewCost={currentPlayer === PlayerEnum.SELF ? hoveredGenerationCost : undefined}
      additionalClass="h-10 w-fit min-w-0 px-2 py-1"
    />

    <EndTurnButton compact={true} additionalClass="mt-0 mb-0 h-10 w-10 rounded-2xl px-0 py-0" />

    <div title={generationModeLabel} aria-label={generationModeLabel}>
      <AppButton
        additionalClass="mt-0 mb-0 h-10 w-10 rounded-2xl px-0 py-0"
        onclick={onToggleGenerationMode}
        disabled={!isHumanTurn || isAutomationRunning || winner !== null}
      >
        <Icon icon={generationModeIcon} size={20} />
        <span class="sr-only">{generationModeLabel}</span>
      </AppButton>
    </div>
  </div>
</div>
