<script lang="ts">
  import type { Player } from "$lib/domain/enums/Player";
  import { Player as PlayerEnum } from "$lib/domain/enums/Player";
  import { PieceType } from "$lib/domain/enums/PieceType";
  import AppButton from "$lib/presentation/components/primitives/AppButton.svelte";
  import Icon from "$lib/presentation/components/primitives/Icon.svelte";
  import IconButton from "$lib/presentation/components/primitives/IconButton.svelte";
  import EndTurnButton from "./EndTurnButton.svelte";
  import GeneratePieceButton from "./GeneratePieceButton.svelte";
  import PlayerIdentityBadge from "./PlayerIdentityBadge.svelte";
  import { m } from "$lib/paraglide/messages";

  let {
    compact,
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
    onPreviewChange,
    onOpenLeaveDialog,
  }: {
    compact: boolean;
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

<GeneratePieceButton pieceType={PieceType.KNIGHT} {compact} {onPreviewChange} />
<GeneratePieceButton pieceType={PieceType.ROOK} {compact} {onPreviewChange} />
<GeneratePieceButton pieceType={PieceType.BISHOP} {compact} {onPreviewChange} />

<PlayerIdentityBadge
  player="opponent"
  label={opponentLabel}
  resource={opponentResources}
  {compact}
  previewCost={currentPlayer === PlayerEnum.OPPONENT ? hoveredGenerationCost : undefined}
/>

<IconButton icon="exit_to_app" label={m.leave_match()} onclick={onOpenLeaveDialog} />
