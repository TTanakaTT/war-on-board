<script lang="ts" module>
  import type { PieceType, Player as PlayerValue } from "#lib/domain/model.ts";
  import type { HpGaugeTarget } from "#lib/presentation/hpGauge.ts";

  interface DrawnGauge extends HpGaugeTarget {
    pieceType: PieceType;
    player: PlayerValue;
    turnNum: number;
  }

  // A token is redrawn when its piece moves to another panel; this lets the new one animate
  // from what the old one showed. Entries from an earlier match are told apart by turn number.
  // Not reactive on purpose: tokens only read it when they mount.
  const lastDrawn: Record<number, DrawnGauge> = {};
</script>

<script lang="ts">
  import { type Piece, pieceConfig, Player } from "#lib/domain/model.ts";
  import { TurnRepository } from "#lib/store.svelte.ts";
  import Icon from "#lib/presentation/components/primitives/Icon.svelte";
  import {
    advanceHpGauge,
    frontUnitFill,
    unitLost,
    type HpGauge,
  } from "#lib/presentation/hpGauge.ts";
  import {
    HP_GAUGE_DRAIN_MS,
    HP_GAUGE_FILL_MS,
    HP_GAUGE_HEIGHT_PX,
    HP_GAUGE_JOIN_DISTANCE_PX,
    HP_GAUGE_JOIN_MS,
    HP_GAUGE_JOIN_STAGGER_MS,
    HP_GAUGE_MAX_VISIBLE,
    HP_GAUGE_SHIFT_MS,
    HP_GAUGE_STACK_OFFSET_PX,
    HP_GAUGE_TRAIL_DELAY_MS,
    HP_GAUGE_TRAIL_MS,
    HP_GAUGE_WIDTH_PX,
    STACK_BADGE_POP_MS,
    STACK_BADGE_POP_SCALE,
  } from "#lib/presentation/layout.ts";
  import { fly, scale, slide } from "svelte/transition";
  import { untrack } from "svelte";

  interface Props {
    piece: Piece;
    isSelected?: boolean;
  }

  let { piece, isSelected = false }: Props = $props();

  let pieceColorClass = $derived(
    piece.player === Player.SELF
      ? "text-player-self border-player-self"
      : "text-player-opponent border-player-opponent",
  );
  let stackBadgeClass = $derived(
    piece.player === Player.SELF
      ? "bg-player-self text-player-opponent"
      : "bg-player-opponent text-player-self",
  );

  let pieceId = $derived(piece.id);
  let pieceType = $derived(piece.pieceType);
  let player = $derived(piece.player);
  let stackCount = $derived(piece.stackCount);
  let hp = $derived(piece.hp);
  let frontFill = $derived(frontUnitFill(piece));
  let turnNum = $derived(TurnRepository.get().num);

  function initiallyShown(): HpGaugeTarget {
    const drawn: DrawnGauge | undefined = lastDrawn[pieceId];
    const sinceDrawn = drawn ? turnNum - drawn.turnNum : -1;
    const resumes =
      drawn?.pieceType === pieceType &&
      drawn.player === player &&
      sinceDrawn >= 0 &&
      sinceDrawn <= 1;
    return resumes ? drawn : { stackCount, hp, frontFill };
  }
  const initial = untrack(initiallyShown);
  let shown = $state.raw(initial);

  $effect(() => {
    const target = { stackCount, hp, frontFill };
    lastDrawn[pieceId] = { pieceType, player, turnNum, ...target };
    if (untrack(() => shown.stackCount === stackCount && shown.hp === hp)) return;
    // Waits a frame so a newly mounted token first draws its previous state.
    const frame = requestAnimationFrame(() => (shown = target));
    return () => cancelAnimationFrame(frame);
  });

  let latestGauge: HpGauge | undefined;
  let gauge = $derived.by(() => {
    latestGauge = advanceHpGauge(latestGauge, shown);
    return latestGauge;
  });

  // After a loss the remaining gauges wait for the lost ones to drain, then move forward.
  let shiftDelayMs = $derived(gauge.lostUnits > 0 ? HP_GAUGE_DRAIN_MS : 0);
  let fillDelayMs = $derived(gauge.lostUnits > 0 ? HP_GAUGE_DRAIN_MS + HP_GAUGE_SHIFT_MS : 0);
  // The badge changes when the lost gauges fall away, not when the damage lands.
  let badgeCount = $state(initial.stackCount);
  $effect(() => {
    const next = gauge.stackCount;
    const timer = setTimeout(() => (badgeCount = next), shiftDelayMs);
    return () => clearTimeout(timer);
  });
  const joinDelayMs = (index: number) =>
    gauge.lostUnits > 0
      ? HP_GAUGE_DRAIN_MS
      : Math.max(0, index - gauge.firstJoinedIndex) * HP_GAUGE_JOIN_STAGGER_MS;

  const gaugeAreaStyle = `width: ${HP_GAUGE_WIDTH_PX}px; height: ${HP_GAUGE_HEIGHT_PX + (HP_GAUGE_MAX_VISIBLE - 1) * HP_GAUGE_STACK_OFFSET_PX}px;`;
</script>

<div class="relative flex flex-col items-center">
  <div
    class="relative mb-1 transition-transform duration-200 {isSelected ? '-translate-y-0.5' : ''}"
    style={gaugeAreaStyle}
  >
    {#each gauge.bars as bar, index (bar.key)}
      <div
        class="bg-outline dark:bg-outline-dark ring-health-edge absolute bottom-0 left-0 overflow-hidden rounded-full ring-1"
        style="width: {HP_GAUGE_WIDTH_PX}px; height: {HP_GAUGE_HEIGHT_PX}px; z-index: {HP_GAUGE_MAX_VISIBLE -
          index}; translate: 0 {-index *
          HP_GAUGE_STACK_OFFSET_PX}px; transition: translate {HP_GAUGE_SHIFT_MS}ms ease-out {shiftDelayMs}ms;"
        in:fly={{
          y: -HP_GAUGE_JOIN_DISTANCE_PX,
          duration: HP_GAUGE_JOIN_MS,
          delay: joinDelayMs(index),
        }}
        out:unitLost
      >
        <div
          data-hp-trail
          class="bg-health-damage absolute inset-y-0 left-0"
          style="width: {bar.fill * 100}%; transition: {gauge.damaged
            ? `width ${HP_GAUGE_TRAIL_MS}ms ease-in-out ${fillDelayMs + HP_GAUGE_TRAIL_DELAY_MS}ms`
            : 'none'};"
        ></div>
        <div
          data-hp-fill
          class="bg-health-fill absolute inset-y-0 left-0"
          style="width: {bar.fill *
            100}%; transition: width {HP_GAUGE_FILL_MS}ms ease-out {fillDelayMs}ms;"
        ></div>
      </div>
    {/each}

    {#if badgeCount > 1}
      {#key badgeCount}
        <span
          class="absolute top-1/2 left-full ml-0.5 flex h-3.5 min-w-3.5 -translate-y-1/2 items-center justify-center rounded-full px-0.5 text-[9px] leading-none font-bold {stackBadgeClass}"
          in:scale={{ start: STACK_BADGE_POP_SCALE, opacity: 1, duration: STACK_BADGE_POP_MS }}
        >
          {badgeCount}
        </span>
      {/key}
    {/if}
  </div>

  <div class="relative transition-transform duration-200 {isSelected ? 'scale-110' : ''}">
    <Icon
      icon={pieceConfig(piece.pieceType).iconName}
      size={22}
      transition={slide}
      transitionParams={{ duration: 500, axis: "y" }}
      additionalClass="bg-primary-variant dark:bg-primary-variant-dark rounded-xl p-1 {isSelected
        ? 'border-3 -my-0.5'
        : 'border'} {pieceColorClass}"
    />
  </div>
</div>
