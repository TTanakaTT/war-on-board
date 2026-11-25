import { pieceConfig, type Piece } from "#lib/domain/model.ts";
import { cubicOut } from "svelte/easing";
import type { TransitionConfig } from "svelte/transition";
import {
  HP_GAUGE_DAMAGE_MS,
  HP_GAUGE_DROP_DISTANCE_PX,
  HP_GAUGE_DROP_MS,
  HP_GAUGE_MAX_VISIBLE,
} from "#lib/presentation/layout.ts";

export interface HpGaugeBar {
  /** Stable while the same unit stays visible, so its element moves instead of being redrawn. */
  key: number;
  /** 0–1. */
  fill: number;
}

/** What the gauge is drawn from. */
export interface HpGaugeTarget {
  stackCount: number;
  hp: number;
  frontFill: number;
}

export interface HpGauge extends HpGaugeTarget {
  /** Front unit first. */
  bars: HpGaugeBar[];
  /** HP went down: the lost part lingers in the damage color (a merge can also lower the front). */
  damaged: boolean;
  /** Units lost by the latest change: the rest wait for their gauges to drain and drop. */
  lostUnits: number;
  /** Index of the first gauge added by the latest change. */
  firstJoinedIndex: number;
  nextKey: number;
}

/** Only the front unit is damaged; the others are full. */
export const frontUnitFill = (piece: Pick<Piece, "pieceType" | "hp" | "stackCount">): number => {
  const unitMaxHp = pieceConfig(piece.pieceType).maxHp;
  const frontHp = piece.hp - (piece.stackCount - 1) * unitMaxHp;
  return Math.min(1, Math.max(0, frontHp / unitMaxHp));
};

/** Lost units leave from the front; added units line up at the back. */
export function advanceHpGauge(previous: HpGauge | undefined, target: HpGaugeTarget): HpGauge {
  const { stackCount, frontFill } = target;
  const lostUnits = previous ? Math.max(0, previous.stackCount - stackCount) : 0;
  const visible = Math.min(stackCount, HP_GAUGE_MAX_VISIBLE);
  const bars = (previous?.bars ?? [])
    .slice(lostUnits, lostUnits + visible)
    .map((bar) => ({ ...bar, fill: 1 }));
  const firstJoinedIndex = previous ? bars.length : visible;
  let nextKey = previous?.nextKey ?? 0;
  while (bars.length < visible) bars.push({ key: nextKey++, fill: 1 });
  if (bars.length > 0) bars[0] = { ...bars[0], fill: frontFill };
  const damaged = previous !== undefined && target.hp < previous.hp;
  return { ...target, bars, damaged, lostUnits, firstJoinedIndex, nextKey };
}

/**
 * Outro for a lost unit's gauge: the fill empties like any damage, the damage-colored trail
 * following halfway behind, then the gauge falls away above the others.
 */
export function unitLost(node: HTMLElement): TransitionConfig {
  const fill = node.querySelector<HTMLElement>("[data-hp-fill]");
  const trail = node.querySelector<HTMLElement>("[data-hp-trail]");
  const fillStart = fill ? parseFloat(fill.style.width) || 0 : 0;
  const trailStart = Math.max(fillStart, trail ? parseFloat(trail.style.width) || 0 : 0);
  for (const el of [fill, trail]) if (el) el.style.transition = "none";

  const duration = HP_GAUGE_DAMAGE_MS + HP_GAUGE_DROP_MS;
  const trailLagMs = HP_GAUGE_DAMAGE_MS / 2;
  const elapsedMs = (t: number) => (1 - t) * duration;
  const progress = (ms: number, from: number, length: number) =>
    Math.min(1, Math.max(0, (ms - from) / length));
  return {
    duration,
    tick: (t) => {
      const ms = elapsedMs(t);
      const emptied = cubicOut(progress(ms, 0, HP_GAUGE_DAMAGE_MS));
      const trailed = progress(ms, trailLagMs, HP_GAUGE_DAMAGE_MS - trailLagMs);
      if (fill) fill.style.width = `${fillStart * (1 - emptied)}%`;
      if (trail) trail.style.width = `${trailStart * (1 - trailed)}%`;
    },
    css: (t) => {
      const dropped = progress(elapsedMs(t), HP_GAUGE_DAMAGE_MS, HP_GAUGE_DROP_MS);
      return `z-index: ${HP_GAUGE_MAX_VISIBLE + 1}; opacity: ${1 - dropped}; transform: translateY(${dropped * HP_GAUGE_DROP_DISTANCE_PX}px);`;
    },
  };
}
