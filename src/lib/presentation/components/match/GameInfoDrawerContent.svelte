<script lang="ts">
  import { MatchControlRepository } from "#lib/data/repositories/MatchControlRepository.ts";
  import { MatchStatsRepository } from "#lib/data/repositories/MatchStatsRepository.ts";
  import { PanelRepository } from "#lib/data/repositories/PanelRepository.ts";
  import { PiecesRepository } from "#lib/data/repositories/PieceRepository.ts";
  import { TurnRepository } from "#lib/data/repositories/TurnRepository.ts";
  import { Player } from "#lib/domain/enums/Player.ts";
  import { m } from "#lib/paraglide/messages.js";
  import Icon from "#lib/presentation/components/primitives/Icon.svelte";
  import { pieceTypeLabel } from "#lib/presentation/piecePresentation.ts";
  import { playerDisplayName, playerInfoOrder } from "#lib/presentation/matchPresentation.ts";
  import {
    armyPower,
    deadCombatUnitCounts,
    liveCombatUnitCounts,
    visiblePieceTypeCounts,
    type PieceTypeCount,
  } from "#lib/presentation/playerInfoPresentation.ts";

  interface PlayerInfoCard {
    id: "self" | "opponent";
    label: string;
    resources: number;
    resourceIncome: number;
    totalProducedResources: number;
    totalCastle: number;
    totalBuiltCastle: number;
    occupiedPanels: number;
    armyPower: number;
    lostArmyPower: number;
    visibleLiveUnitCounts: PieceTypeCount[];
    visibleDeadUnitCounts: PieceTypeCount[];
  }

  interface Props {
    isWideLayout?: boolean;
    isBrowserLayout?: boolean;
  }

  let { isWideLayout = false, isBrowserLayout = false }: Props = $props();

  let matchControl = $derived(MatchControlRepository.get());
  let matchStats = $derived(MatchStatsRepository.get());
  let panels = $derived(PanelRepository.getAll());
  let pieces = $derived(PiecesRepository.getAll());
  let turn = $derived(TurnRepository.get());

  function buildPlayerInfo(player: Player): PlayerInfoCard {
    const playerId = player === Player.SELF ? "self" : "opponent";
    const ownedPanels = panels.filter((panel) => panel.player === player);
    const ownedPieces = pieces.filter((piece) => piece.player === player);
    const playerStats = matchStats[playerId];
    const liveCounts = liveCombatUnitCounts(ownedPieces);
    const deadCounts = deadCombatUnitCounts(playerStats.deadUnitCounts);

    return {
      id: playerId,
      label: playerDisplayName(player, matchControl.controllers, matchControl.aiStrengths),
      resources: turn.resources[String(player)] ?? 0,
      resourceIncome: ownedPanels.reduce((sum, panel) => sum + panel.resource, 0),
      totalProducedResources: playerStats.totalProducedResources,
      totalCastle: ownedPanels.reduce((sum, panel) => sum + panel.castle, 0),
      totalBuiltCastle: playerStats.totalBuiltCastle,
      occupiedPanels: ownedPanels.length,
      armyPower: armyPower(liveCounts),
      lostArmyPower: armyPower(deadCounts),
      visibleLiveUnitCounts: visiblePieceTypeCounts(liveCounts),
      visibleDeadUnitCounts: visiblePieceTypeCounts(deadCounts),
    };
  }

  function panelClass(playerId: PlayerInfoCard["id"], isWideLayoutValue: boolean): string {
    return `border-2 bg-player-card-surface shadow-sm ${isWideLayoutValue ? "rounded-2xl p-4" : "rounded-xl p-3"} ${playerId === "self" ? "border-player-self text-player-self" : "border-player-opponent text-player-opponent"}`;
  }

  function unitPanelClass(playerId: PlayerInfoCard["id"]): string {
    return playerId === "self"
      ? "border border-player-self text-player-self"
      : "border border-player-opponent text-player-opponent";
  }

  function infoLabelClass(playerId: PlayerInfoCard["id"]): string {
    return playerId === "self" ? "text-player-self-muted" : "text-player-opponent-muted";
  }

  let playerCards = $derived(
    playerInfoOrder(isWideLayout || isBrowserLayout).map((player) => buildPlayerInfo(player)),
  );
  let containerClass = $derived(
    isWideLayout ? "grid grid-cols-2 items-start gap-4" : "flex flex-col gap-4",
  );
</script>

{#snippet unitCountRows(counts: PieceTypeCount[])}
  {#each counts as pieceTypeCount (pieceTypeCount.pieceType)}
    <div class="flex items-center justify-between gap-4">
      <span title={pieceTypeLabel(pieceTypeCount.pieceType)}>
        <Icon icon={pieceTypeCount.pieceType.config.iconName} size={20} />
      </span>
      <span class="font-semibold">{pieceTypeCount.count}</span>
    </div>
  {/each}
{/snippet}

<!-- PROTOTYPE ONLY: layout 1 — label and total on one line at the left, the breakdown box at the right. -->
{#snippet armyPowerLayout1(
  cardId: PlayerInfoCard["id"],
  label: string,
  total: number,
  counts: PieceTypeCount[],
)}
  <div class="flex items-center gap-4">
    <dt class="whitespace-nowrap">{label}</dt>
    <dd class="font-semibold">{total}</dd>
    <dd class="ms-auto grid gap-2 rounded-xl border p-3 {unitPanelClass(cardId)}">
      {@render unitCountRows(counts)}
    </dd>
  </div>
{/snippet}

<!-- PROTOTYPE ONLY: layout 2 — total under the label at the left, the breakdown box at the right. -->
{#snippet armyPowerLayout2(
  cardId: PlayerInfoCard["id"],
  label: string,
  total: number,
  counts: PieceTypeCount[],
)}
  <div class="grid grid-cols-[1fr_auto] items-center gap-x-4">
    <dt class="self-end whitespace-nowrap">{label}</dt>
    <dd class="row-start-2 self-start text-base font-semibold">{total}</dd>
    <dd
      class="col-start-2 row-span-2 row-start-1 grid gap-2 rounded-xl border p-3 {unitPanelClass(
        cardId,
      )}"
    >
      {@render unitCountRows(counts)}
    </dd>
  </div>
{/snippet}

<div class={containerClass}>
  {#each playerCards as card (card.id)}
    <section class="min-w-0 {panelClass(card.id, isWideLayout)}">
      <h2 class="text-base font-semibold">
        {card.label}
      </h2>

      <dl class="mt-4 grid gap-3 text-sm">
        <div class="flex items-center justify-between gap-4">
          <dt class="flex items-center gap-2 {infoLabelClass(card.id)}">
            <Icon icon="home" size={18} />
          </dt>
          <dd class="font-semibold">{card.resources} (+{card.resourceIncome})</dd>
        </div>
        <div class="flex items-center justify-between gap-4">
          <dt class="flex items-center gap-2 {infoLabelClass(card.id)}">
            <Icon icon="castle" size={18} />
          </dt>
          <dd class="font-semibold">{card.totalCastle}</dd>
        </div>
        <div class="flex items-center justify-between gap-4">
          <dt class="flex items-center gap-2 {infoLabelClass(card.id)}">
            <span>{m.total_produced_resources_label()}</span>
            <Icon icon="home" size={18} />
          </dt>
          <dd class="font-semibold">{card.totalProducedResources}</dd>
        </div>
        <div class="flex items-center justify-between gap-4">
          <dt class="flex items-center gap-2 {infoLabelClass(card.id)}">
            <span>{m.total_built_castle_label()}</span>
            <Icon icon="castle" size={18} />
          </dt>
          <dd class="font-semibold">{card.totalBuiltCastle}</dd>
        </div>
        <div class="flex items-center justify-between gap-4">
          <dt>{m.occupied_panels_label()}</dt>
          <dd class="font-semibold">{card.occupiedPanels}</dd>
        </div>
        <!-- PROTOTYPE ONLY: both layouts are shown for comparison. -->
        <p class="text-xs {infoLabelClass(card.id)}">案1</p>
        {@render armyPowerLayout1(
          card.id,
          m.army_power_label(),
          card.armyPower,
          card.visibleLiveUnitCounts,
        )}
        {@render armyPowerLayout1(
          card.id,
          m.lost_army_power_label(),
          card.lostArmyPower,
          card.visibleDeadUnitCounts,
        )}
        <p class="text-xs {infoLabelClass(card.id)}">案2</p>
        {@render armyPowerLayout2(
          card.id,
          m.army_power_label(),
          card.armyPower,
          card.visibleLiveUnitCounts,
        )}
        {@render armyPowerLayout2(
          card.id,
          m.lost_army_power_label(),
          card.lostArmyPower,
          card.visibleDeadUnitCounts,
        )}
      </dl>
    </section>
  {/each}
</div>
