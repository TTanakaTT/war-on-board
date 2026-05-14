<script lang="ts">
  import { MatchControlRepository } from "$lib/data/repositories/MatchControlRepository";
  import { MatchStatsRepository } from "$lib/data/repositories/MatchStatsRepository";
  import { PanelRepository } from "$lib/data/repositories/PanelRepository";
  import { PiecesRepository } from "$lib/data/repositories/PieceRepository";
  import { PieceType } from "$lib/domain/enums/PieceType";
  import { Player } from "$lib/domain/enums/Player";
  import { m } from "$lib/paraglide/messages";
  import Icon from "$lib/presentation/components/primitives/Icon.svelte";
  import { PIECE_TYPE_DISPLAY_ORDER, pieceTypeLabel } from "$lib/presentation/piecePresentation";
  import { playerDisplayName, playerInfoOrder } from "$lib/presentation/matchPresentation";

  type PieceCounter = {
    pieceType: PieceType;
    liveCount: number;
    deadCount: number;
  };

  interface PlayerInfoCard {
    id: "self" | "opponent";
    label: string;
    resourceIncome: number;
    totalProducedResources: number;
    totalCastle: number;
    totalBuiltCastle: number;
    occupiedPanels: number;
    pieceCounters: PieceCounter[];
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

  function deadCountByType(cardId: PlayerInfoCard["id"], pieceType: PieceType): number {
    const playerStats = matchStats[cardId];

    if (pieceType === PieceType.ROOK) {
      return playerStats.deadUnitCounts.rook;
    }

    if (pieceType === PieceType.BISHOP) {
      return playerStats.deadUnitCounts.bishop;
    }

    return playerStats.deadUnitCounts.knight;
  }

  function buildPlayerInfo(player: Player): PlayerInfoCard {
    const playerId = player === Player.SELF ? "self" : "opponent";
    const ownedPanels = panels.filter((panel) => panel.player === player);
    const ownedPieces = pieces.filter((piece) => piece.player === player);
    const playerStats = matchStats[playerId];

    return {
      id: playerId,
      label: playerDisplayName(player, matchControl.controllers, matchControl.aiStrengths),
      resourceIncome: ownedPanels.reduce((sum, panel) => sum + panel.resource, 0),
      totalProducedResources: playerStats.totalProducedResources,
      totalCastle: ownedPanels.reduce((sum, panel) => sum + panel.castle, 0),
      totalBuiltCastle: playerStats.totalBuiltCastle,
      occupiedPanels: ownedPanels.length,
      pieceCounters: PIECE_TYPE_DISPLAY_ORDER.map((pieceType) => ({
        pieceType,
        liveCount: ownedPieces.filter((piece) => piece.pieceType === pieceType).length,
        deadCount: deadCountByType(playerId, pieceType),
      })),
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
          <dd class="font-semibold">+{card.resourceIncome}</dd>
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
        <div class="flex items-center justify-between gap-4">
          <dt>{m.unit_count_label()}</dt>

          <dd class="rounded-xl border p-3 text-sm {unitPanelClass(card.id)}">
            <div class="grid gap-2">
              {#each card.pieceCounters as pieceCounter (pieceCounter.pieceType)}
                <div class="flex items-center justify-between gap-4">
                  <span title={pieceTypeLabel(pieceCounter.pieceType)}>
                    <Icon icon={pieceCounter.pieceType.config.iconName} size={20} />
                  </span>
                  <span class="font-semibold">{pieceCounter.liveCount}</span>
                </div>
              {/each}
            </div>
          </dd>
        </div>
        <div class="flex items-center justify-between gap-4">
          <dt>{m.dead_unit_count_label()}</dt>

          <dd class="rounded-xl border p-3 text-sm {unitPanelClass(card.id)}">
            <div class="grid gap-2">
              {#each card.pieceCounters as pieceCounter (pieceCounter.pieceType)}
                <div class="flex items-center justify-between gap-4">
                  <span title={pieceTypeLabel(pieceCounter.pieceType)}>
                    <Icon icon={pieceCounter.pieceType.config.iconName} size={20} />
                  </span>
                  <span class="font-semibold">{pieceCounter.deadCount}</span>
                </div>
              {/each}
            </div>
          </dd>
        </div>
      </dl>
    </section>
  {/each}
</div>
