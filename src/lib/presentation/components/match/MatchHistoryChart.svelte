<script lang="ts">
  import type { BySide, MatchHistoryExport } from "#lib/domain/types.ts";
  import { SIDES, type Side } from "#lib/domain/model.ts";
  import { m } from "#lib/paraglide/messages.js";
  import { seatLabel } from "#lib/presentation/labels.ts";
  import {
    HISTORY_CHART_DASH_ARRAY,
    HISTORY_CHART_HEIGHT_PX,
    HISTORY_CHART_LABEL_GAP_PX,
    HISTORY_CHART_LEGEND_LINE_PX,
    HISTORY_CHART_LINE_WIDTH_PX,
    HISTORY_CHART_MIN_X_TICK_SPACING_PX,
    HISTORY_CHART_PADDING_PX,
    HISTORY_CHART_POINT_RADIUS_PX,
    HISTORY_CHART_TARGET_Y_TICKS,
    HISTORY_CHART_TOOLTIP_OFFSET_PX,
  } from "#lib/presentation/layout.ts";
  import HorizontalRadioGroup from "#lib/presentation/components/primitives/HorizontalRadioGroup.svelte";

  type Entry = MatchHistoryExport["entries"][number];
  type MetricKey = {
    [K in keyof Entry]: Entry[K] extends BySide<number> ? K : never;
  }[keyof Entry];
  type Axis = "left" | "right";
  type ChartMode = "totals" | "army" | "territory";

  interface Metric {
    key: MetricKey;
    label: () => string;
    axis: Axis;
    dashed: boolean;
  }

  interface AxisScale {
    ticks: number[];
    max: number;
  }

  const CHART_MODES: Record<ChartMode, { label: () => string; metrics: Metric[] }> = {
    totals: {
      label: m.history_chart_mode_totals,
      metrics: [
        {
          key: "totalProducedResources",
          label: m.history_metric_total_produced_resources,
          axis: "left",
          dashed: false,
        },
        {
          key: "totalBuiltCastle",
          label: m.history_metric_total_built_castle,
          axis: "right",
          dashed: true,
        },
      ],
    },
    army: {
      label: m.history_chart_mode_army,
      metrics: [
        { key: "armyPower", label: m.army_power_label, axis: "left", dashed: false },
        { key: "lostArmyPower", label: m.lost_army_power_label, axis: "left", dashed: true },
      ],
    },
    territory: {
      label: m.history_chart_mode_territory,
      metrics: [
        { key: "occupiedPanels", label: m.occupied_panels_label, axis: "left", dashed: false },
        { key: "wallTotals", label: m.history_metric_wall_total, axis: "right", dashed: true },
      ],
    },
  };
  const CHART_MODE_ORDER: ChartMode[] = ["totals", "army", "territory"];
  const AXES: Axis[] = ["left", "right"];
  const PAD = HISTORY_CHART_PADDING_PX;

  let { matchHistory }: { matchHistory: MatchHistoryExport } = $props();

  let mode = $state<ChartMode>("totals");
  let width = $state(0);
  let svg = $state<SVGSVGElement | undefined>(undefined);
  let hoveredIndex = $state<number | null>(null);

  let entries = $derived(matchHistory.entries);
  let metrics = $derived(CHART_MODES[mode].metrics);
  let hasRightAxis = $derived(metrics.some((metric) => metric.axis === "right"));
  let plotLeft = PAD.axis;
  let plotRight = $derived(width - (hasRightAxis ? PAD.axis : PAD.edge));
  let plotTop = PAD.top;
  let plotBottom = HISTORY_CHART_HEIGHT_PX - PAD.bottom;
  let plotWidth = $derived(Math.max(0, plotRight - plotLeft));

  let axes = $derived.by(() => {
    const scales: Partial<Record<Axis, AxisScale>> = {};
    for (const axis of AXES) {
      const values = metrics
        .filter((metric) => metric.axis === axis)
        .flatMap((metric) =>
          entries.flatMap((entry) => SIDES.map((side) => entry[metric.key][side])),
        );
      if (values.length > 0) scales[axis] = axisScale(Math.max(...values));
    }
    return scales;
  });

  let series = $derived(
    metrics.flatMap((metric) =>
      SIDES.map((side) => ({
        id: `${metric.key}-${side}`,
        side,
        dashed: metric.dashed,
        points: entries
          .map((entry, index) => `${xAt(index)},${yAt(metric.axis, entry[metric.key][side])}`)
          .join(" "),
      })),
    ),
  );

  // Ticks sit on the first entry of a turn; the step keeps labels from overlapping.
  let xTicks = $derived.by(() => {
    const lastTurn = entries.at(-1)?.capturedAtTurn ?? 1;
    const pixelsPerTurn = plotWidth / Math.max(1, lastTurn);
    const step = Math.max(1, niceStep(HISTORY_CHART_MIN_X_TICK_SPACING_PX / pixelsPerTurn));
    return entries.flatMap((entry, index) =>
      entries[index - 1]?.capturedAtTurn !== entry.capturedAtTurn &&
      entry.capturedAtTurn % step === 0
        ? [{ index, turn: entry.capturedAtTurn }]
        : [],
    );
  });

  let hoveredEntry = $derived(hoveredIndex === null ? undefined : entries[hoveredIndex]);

  function niceStep(rough: number): number {
    const magnitude = 10 ** Math.floor(Math.log10(rough));
    const residual = rough / magnitude;
    const factor = residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 5 ? 5 : 10;
    return factor * magnitude;
  }

  // Values are whole numbers, so ticks never step below 1.
  function axisScale(maxValue: number): AxisScale {
    const step = Math.max(1, niceStep(Math.max(1, maxValue) / HISTORY_CHART_TARGET_Y_TICKS));
    const max = Math.max(step, Math.ceil(maxValue / step) * step);
    return { ticks: Array.from({ length: max / step + 1 }, (_, i) => i * step), max };
  }

  function xAt(index: number): number {
    return entries.length <= 1 ? plotLeft : plotLeft + (index / (entries.length - 1)) * plotWidth;
  }

  function yAt(axis: Axis, value: number): number {
    const max = axes[axis]?.max ?? 1;
    return plotBottom - (value / max) * (plotBottom - plotTop);
  }

  function lineClass(side: Side): string {
    return side === "self" ? "stroke-player-self" : "stroke-player-opponent";
  }

  function pointClass(side: Side): string {
    return side === "self"
      ? "fill-player-self stroke-player-opponent"
      : "fill-player-opponent stroke-player-self";
  }

  function legendLabel(metric: Metric): string {
    if (!hasRightAxis) return metric.label();
    return metric.axis === "left"
      ? m.history_axis_left({ label: metric.label() })
      : m.history_axis_right({ label: metric.label() });
  }

  function updateHoveredIndex(event: PointerEvent): void {
    if (!svg || entries.length === 0) return;
    const offsetX = event.clientX - svg.getBoundingClientRect().left;
    const ratio = plotWidth > 0 ? (offsetX - plotLeft) / plotWidth : 0;
    const index = Math.round(ratio * (entries.length - 1));
    hoveredIndex = Math.min(entries.length - 1, Math.max(0, index));
  }

  // A touch keeps its readout after the finger lifts; a mouse clears it on leaving.
  function clearHoveredIndex(event: PointerEvent): void {
    if (event.pointerType === "mouse") hoveredIndex = null;
  }

  function tooltipPosition(index: number): string {
    const x = xAt(index);
    const horizontal =
      x > width / 2
        ? `right: ${width - x + HISTORY_CHART_TOOLTIP_OFFSET_PX}px;`
        : `left: ${x + HISTORY_CHART_TOOLTIP_OFFSET_PX}px;`;
    return `${horizontal} top: ${plotTop}px;`;
  }
</script>

<div class="grid gap-3">
  <HorizontalRadioGroup
    name="match-history-chart-mode"
    ariaLabel={m.history_chart_mode_label()}
    options={CHART_MODE_ORDER.map((value) => ({ value, label: CHART_MODES[value].label() }))}
    value={mode}
    onChange={(value) => (mode = value as ChartMode)}
  />

  <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
    {#each SIDES as side (side)}
      <span class="inline-flex items-center gap-1.5">
        <span class="bg-player-card-surface inline-flex rounded p-1">
          <svg width={HISTORY_CHART_LEGEND_LINE_PX} height={HISTORY_CHART_LINE_WIDTH_PX}>
            <line
              x1="0"
              y1={HISTORY_CHART_LINE_WIDTH_PX / 2}
              x2={HISTORY_CHART_LEGEND_LINE_PX}
              y2={HISTORY_CHART_LINE_WIDTH_PX / 2}
              class={lineClass(side)}
              stroke-width={HISTORY_CHART_LINE_WIDTH_PX}
            />
          </svg>
        </span>
        {seatLabel(side)}
      </span>
    {/each}
    {#each metrics as metric (metric.key)}
      <span class="inline-flex items-center gap-1.5">
        <svg width={HISTORY_CHART_LEGEND_LINE_PX} height={HISTORY_CHART_LINE_WIDTH_PX}>
          <line
            x1="0"
            y1={HISTORY_CHART_LINE_WIDTH_PX / 2}
            x2={HISTORY_CHART_LEGEND_LINE_PX}
            y2={HISTORY_CHART_LINE_WIDTH_PX / 2}
            class="stroke-onsurface dark:stroke-onsurface-dark"
            stroke-width={HISTORY_CHART_LINE_WIDTH_PX}
            stroke-dasharray={metric.dashed ? HISTORY_CHART_DASH_ARRAY : undefined}
          />
        </svg>
        {legendLabel(metric)}
      </span>
    {/each}
  </div>

  <div class="relative" bind:clientWidth={width}>
    {#if width > 0}
      <svg
        bind:this={svg}
        {width}
        height={HISTORY_CHART_HEIGHT_PX}
        class="block text-xs select-none"
        role="img"
        aria-label={CHART_MODES[mode].label()}
      >
        <rect
          x={plotLeft}
          y={plotTop}
          width={plotWidth}
          height={plotBottom - plotTop}
          class="fill-player-card-surface"
        />

        {#each axes.left?.ticks ?? [] as tick (tick)}
          <line
            x1={plotLeft}
            x2={plotRight}
            y1={yAt("left", tick)}
            y2={yAt("left", tick)}
            class="stroke-player-self/25"
          />
          <text
            x={plotLeft - HISTORY_CHART_LABEL_GAP_PX}
            y={yAt("left", tick)}
            text-anchor="end"
            dominant-baseline="middle"
            class="fill-onsurface dark:fill-onsurface-dark">{tick}</text
          >
        {/each}

        {#each axes.right?.ticks ?? [] as tick (tick)}
          <text
            x={plotRight + HISTORY_CHART_LABEL_GAP_PX}
            y={yAt("right", tick)}
            dominant-baseline="middle"
            class="fill-onsurface dark:fill-onsurface-dark">{tick}</text
          >
        {/each}

        {#each xTicks as tick (tick.index)}
          <text
            x={xAt(tick.index)}
            y={plotBottom + HISTORY_CHART_LABEL_GAP_PX}
            text-anchor="middle"
            dominant-baseline="hanging"
            class="fill-onsurface dark:fill-onsurface-dark">{tick.turn}</text
          >
        {/each}
        <text
          x={plotRight}
          y={HISTORY_CHART_HEIGHT_PX}
          text-anchor="end"
          dominant-baseline="text-after-edge"
          class="fill-onsurface dark:fill-onsurface-dark">{m.history_turn_label()}</text
        >

        {#each series as line (line.id)}
          <polyline
            points={line.points}
            fill="none"
            class={lineClass(line.side)}
            stroke-width={HISTORY_CHART_LINE_WIDTH_PX}
            stroke-linejoin="round"
            stroke-dasharray={line.dashed ? HISTORY_CHART_DASH_ARRAY : undefined}
          />
        {/each}

        {#if hoveredEntry && hoveredIndex !== null}
          <line
            x1={xAt(hoveredIndex)}
            x2={xAt(hoveredIndex)}
            y1={plotTop}
            y2={plotBottom}
            class="stroke-onsurface dark:stroke-onsurface-dark"
          />
          {#each metrics as metric (metric.key)}
            {#each SIDES as side (side)}
              <circle
                cx={xAt(hoveredIndex)}
                cy={yAt(metric.axis, hoveredEntry[metric.key][side])}
                r={HISTORY_CHART_POINT_RADIUS_PX}
                class={pointClass(side)}
              />
            {/each}
          {/each}
        {/if}

        <rect
          x={plotLeft}
          y={plotTop}
          width={plotWidth}
          height={plotBottom - plotTop}
          fill="transparent"
          class="cursor-crosshair touch-pan-y"
          role="presentation"
          onpointerdown={updateHoveredIndex}
          onpointermove={updateHoveredIndex}
          onpointerleave={clearHoveredIndex}
        />
      </svg>

      {#if hoveredEntry && hoveredIndex !== null}
        <div
          class="border-outline dark:border-outline-dark bg-background dark:bg-background-dark text-onbackground dark:text-onbackground-dark pointer-events-none absolute rounded-lg border px-3 py-2 text-xs shadow-lg"
          style={tooltipPosition(hoveredIndex)}
        >
          <div class="mb-1 font-semibold whitespace-nowrap">
            {m.history_tooltip_title({
              turn: hoveredEntry.capturedAtTurn,
              player: seatLabel(hoveredEntry.turnPlayer),
            })}
          </div>
          <table class="border-separate border-spacing-x-2">
            <thead>
              <tr>
                <th></th>
                {#each SIDES as side (side)}
                  <th scope="col" class="text-right font-medium whitespace-nowrap">
                    {seatLabel(side)}
                  </th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each metrics as metric (metric.key)}
                <tr>
                  <th scope="row" class="text-left font-normal whitespace-nowrap">
                    {metric.label()}
                  </th>
                  {#each SIDES as side (side)}
                    <td class="text-right font-semibold tabular-nums">
                      {hoveredEntry[metric.key][side]}
                    </td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    {/if}
  </div>
</div>
