<script lang="ts">
  import { MatchControlRepository } from "$lib/data/repositories/MatchControlRepository";
  import { MatchStatsRepository } from "$lib/data/repositories/MatchStatsRepository";
  import { PanelRepository } from "$lib/data/repositories/PanelRepository";
  import { PiecesRepository } from "$lib/data/repositories/PieceRepository";
  import { PieceType } from "$lib/domain/enums/PieceType";
  import { Player } from "$lib/domain/enums/Player";
  import { m } from "$lib/paraglide/messages";
  import Icon from "$lib/presentation/components/Icon.svelte";
  import { playerDisplayName, playerInfoOrder } from "$lib/presentation/matchPresentation";

  interface PlayerInfoCard {
    id: "self" | "opponent";
    label: string;
    resourceIncome: number;
    totalProducedResources: number;
    totalCastle: number;
    totalBuiltCastle: number;
    occupiedPanels: number;
    knightCount: number;
    rookCount: number;
    bishopCount: number;
    deadKnightCount: number;
    deadRookCount: number;
    deadBishopCount: number;
  }

  interface Props {
    isWideLayout?: boolean;
  }

  let { isWideLayout = false }: Props = $props();

  let matchControl = $derived(MatchControlRepository.get());
  let matchStats = $derived(MatchStatsRepository.get());
  let panels = $derived(PanelRepository.getAll());
  let pieces = $derived(PiecesRepository.getAll());

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
      knightCount: ownedPieces.filter((piece) => piece.pieceType === PieceType.KNIGHT).length,
      rookCount: ownedPieces.filter((piece) => piece.pieceType === PieceType.ROOK).length,
      bishopCount: ownedPieces.filter((piece) => piece.pieceType === PieceType.BISHOP).length,
      deadKnightCount: playerStats.deadUnitCounts.knight,
      deadRookCount: playerStats.deadUnitCounts.rook,
      deadBishopCount: playerStats.deadUnitCounts.bishop,
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
    playerInfoOrder(isWideLayout).map((player) => buildPlayerInfo(player)),
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
              <div class="flex items-center justify-between gap-4">
                <span title={m.piece_knight()}>
                  <Icon icon={PieceType.KNIGHT.config.iconName} size={20} />
                </span>
                <span class="font-semibold">{card.knightCount}</span>
              </div>
              <div class="flex items-center justify-between gap-4">
                <span title={m.piece_rook()}>
                  <Icon icon={PieceType.ROOK.config.iconName} size={20} />
                </span>
                <span class="font-semibold">{card.rookCount}</span>
              </div>
              <div class="flex items-center justify-between gap-4">
                <span title={m.piece_bishop()}>
                  <Icon icon={PieceType.BISHOP.config.iconName} size={20} />
                </span>
                <span class="font-semibold">{card.bishopCount}</span>
              </div>
            </div>
          </dd>
        </div>
        <div class="flex items-center justify-between gap-4">
          <dt>{m.dead_unit_count_label()}</dt>

          <dd class="rounded-xl border p-3 text-sm {unitPanelClass(card.id)}">
            <div class="grid gap-2">
              <div class="flex items-center justify-between gap-4">
                <span title={m.piece_knight()}>
                  <Icon icon={PieceType.KNIGHT.config.iconName} size={20} />
                </span>
                <span class="font-semibold">{card.deadKnightCount}</span>
              </div>
              <div class="flex items-center justify-between gap-4">
                <span title={m.piece_rook()}>
                  <Icon icon={PieceType.ROOK.config.iconName} size={20} />
                </span>
                <span class="font-semibold">{card.deadRookCount}</span>
              </div>
              <div class="flex items-center justify-between gap-4">
                <span title={m.piece_bishop()}>
                  <Icon icon={PieceType.BISHOP.config.iconName} size={20} />
                </span>
                <span class="font-semibold">{card.deadBishopCount}</span>
              </div>
            </div>
          </dd>
        </div>
      </dl>
    </section>
  {/each}
</div>
