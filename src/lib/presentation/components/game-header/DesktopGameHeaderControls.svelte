<script lang="ts">
  import type { Player } from "$lib/domain/enums/Player";
  import { Player as PlayerEnum } from "$lib/domain/enums/Player";
  import type { PieceType } from "$lib/domain/enums/PieceType";
  import AppButton from "$lib/presentation/components/primitives/AppButton.svelte";
  import Icon from "$lib/presentation/components/primitives/Icon.svelte";
  import IconButton from "$lib/presentation/components/primitives/IconButton.svelte";
  import EndTurnButton from "./EndTurnButton.svelte";
  import GeneratePieceButton from "./GeneratePieceButton.svelte";
  import PlayerIdentityBadge from "./PlayerIdentityBadge.svelte";
  import { m } from "$lib/paraglide/messages";

  let {
    compact,
    useGenerateDropdown,
    generateMenuPieceTypes,
    isGenerateMenuOpen,
    currentPlayer,
    selfLabel,
    selfResources,
    opponentLabel,
    opponentResources,
    hoveredGenerationCost,
    generationModeLabel,
    generationModeIcon,
    isHumanTurn,
    isAutomationRunning,
    winner,
    onToggleGenerationMode,
    onToggleGenerateMenu,
    onPreviewChange,
    onOpenLeaveDialog,
  }: {
    compact: boolean;
    useGenerateDropdown: boolean;
    generateMenuPieceTypes: readonly PieceType[];
    isGenerateMenuOpen: boolean;
    currentPlayer: Player;
    selfLabel: string;
    selfResources: number;
    opponentLabel: string;
    opponentResources: number;
    hoveredGenerationCost: number | undefined;
    generationModeLabel: string;
    generationModeIcon: string;
    isHumanTurn: boolean;
    isAutomationRunning: boolean;
    winner: Player | null;
    onToggleGenerationMode: () => void;
    onToggleGenerateMenu: () => void;
    onPreviewChange: (previewCost: number | undefined) => void;
    onOpenLeaveDialog: () => void;
  } = $props();
</script>

<EndTurnButton {compact} />

<PlayerIdentityBadge
  player="self"
  label={selfLabel}
  resource={selfResources}
  {compact}
  previewCost={currentPlayer === PlayerEnum.SELF ? hoveredGenerationCost : undefined}
/>

<div title={compact ? generationModeLabel : undefined} aria-label={generationModeLabel}>
  <AppButton
    additionalClass={compact ? "h-11 w-11 rounded-2xl px-0" : "px-4"}
    onclick={onToggleGenerationMode}
    disabled={!isHumanTurn || isAutomationRunning || winner !== null}
  >
    <Icon icon={generationModeIcon} size={20} />
    {#if !compact}
      <span>{generationModeLabel}</span>
    {/if}
  </AppButton>
</div>

{#if useGenerateDropdown}
  <div class="relative">
    <AppButton
      additionalClass="h-11 w-11 rounded-2xl px-0"
      onclick={onToggleGenerateMenu}
      variant="primary"
    >
      <Icon icon={generateMenuPieceTypes[0].config.iconName} size={20} />
      <span class="sr-only">{m.produce()}</span>
    </AppButton>

    {#if isGenerateMenuOpen}
      <div class="pointer-events-none absolute top-[calc(100%+0.5rem)] right-0 z-30">
        <div
          class="bg-surface/95 dark:bg-surface-dark/95 border-outline dark:border-outline-dark pointer-events-auto w-max max-w-[calc(100vw-12rem)] rounded-2xl border px-2 py-2 shadow-lg backdrop-blur-sm"
        >
          <div class="flex flex-wrap items-center justify-end gap-2">
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
{:else}
  {#each generateMenuPieceTypes as pieceType (pieceType.config.iconName)}
    <GeneratePieceButton {pieceType} {compact} {onPreviewChange} />
  {/each}
{/if}

<PlayerIdentityBadge
  player="opponent"
  label={opponentLabel}
  resource={opponentResources}
  {compact}
  previewCost={currentPlayer === PlayerEnum.OPPONENT ? hoveredGenerationCost : undefined}
/>

<IconButton icon="exit_to_app" label={m.leave_match()} onclick={onOpenLeaveDialog} />
