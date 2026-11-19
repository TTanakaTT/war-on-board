<script lang="ts">
  import type { BySide, MatchHistoryExport } from "#lib/domain/types.ts";
  import { SIDES, type Side } from "#lib/domain/model.ts";
  import { m } from "#lib/paraglide/messages.js";
  import { seatLabel } from "#lib/presentation/labels.ts";
  import {
    HISTORY_CHART_AXIS_TITLE_GAP_PX,
    HISTORY_CHART_DASH_ARRAY,
    HISTORY_CHART_HEIGHT_PX,
    HISTORY_CHART_LABEL_GAP_PX,
    HISTORY_CHART_LEGEND_LINE_PX,
    HISTORY_CHART_LINE_WIDTH_PX,
    HISTORY_CHART_MIN_X_TICK_SPACING_PX,
    HISTORY_CHART_PADDING_PX,
    HISTORY_CHART_POINT_RADIUS_PX,
    HISTORY_CHART_TARGET_Y_TICKS,
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

  interface ChartModeDefinition {
    label: () => string;
    axisTitles: Partial<Record<Axis, () => string>>;
    metrics: Metric[];
  }

  interface AxisScale {
    ticks: number[];
    max: number;
  }

  const CHART_MODES: Record<ChartMode, ChartModeDefinition> = {
    totals: {
      label: m.history_chart_mode_totals,
      axisTitles: {
        left: m.history_metric_total_produced_resources,
        right: m.history_metric_total_built_castle,
      },
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
      axisTitles: { left: m.army_power_label },
      metrics: [
        { key: "armyPower", label: m.army_power_label, axis: "left", dashed: false },
        { key: "lostArmyPower", label: m.lost_army_power_label, axis: "left", dashed: true },
      ],
    },
    territory: {
      label: m.history_chart_mode_territory,
      axisTitles: { left: m.occupied_panels_label, right: m.history_metric_wall_total },
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
  let pinnedIndex = $state<number | null>(null);

  let entries = $derived(matchHistory.entries);
  let chartMode = $derived(CHART_MODES[mode]);
  let metrics = $derived(chartMode.metrics);
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

  // A click or tap pins a point; mouse hover previews another without moving the pin.
  let activeIndex = $derived(hoveredIndex ?? pinnedIndex);
  let activeEntry = $derived(activeIndex === null ? undefined : entries[activeIndex]);
  let shownIndex = $derived(activeIndex ?? entries.length - 1);
  let shownEntry = $derived(entries[shownIndex]);

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

  // The winning endTurn adds an entry without passing the turn, so it repeats the previous
  // entry's turn and player; it is labelled as the final state instead.
  function pointLabel(index: number, entry: Entry): string {
    const isFinal = index === entries.length - 1 && matchHistory.metadata.winner !== null;
    return isFinal
      ? m.history_point_final({ turn: entry.capturedAtTurn })
      : m.history_point_turn({ turn: entry.capturedAtTurn, player: seatLabel(entry.turnPlayer) });
  }

  function lineClass(side: Side): string {
    return side === "self" ? "stroke-player-self" : "stroke-player-opponent";
  }

  function pointClass(side: Side): string {
    return side === "self"
      ? "fill-player-self stroke-player-opponent"
      : "fill-player-opponent stroke-player-self";
  }

  function indexAt(event: PointerEvent): number | null {
    if (!svg || entries.length === 0) return null;
    const offsetX = event.clientX - svg.getBoundingClientRect().left;
    const ratio = plotWidth > 0 ? (offsetX - plotLeft) / plotWidth : 0;
    const index = Math.round(ratio * (entries.length - 1));
    return Math.min(entries.length - 1, Math.max(0, index));
  }

  function handlePointerDown(event: PointerEvent): void {
    pinnedIndex = indexAt(event);
  }

  function handlePointerMove(event: PointerEvent): void {
    if (event.pointerType === "mouse" && event.buttons === 0) {
      hoveredIndex = indexAt(event);
    } else {
      pinnedIndex = indexAt(event);
    }
  }

  function handlePointerLeave(): void {
    hoveredIndex = null;
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

  <div class="grid gap-1">
    {#if shownEntry}
      <table class="w-full border-collapse text-xs">
        <thead>
          <tr class="border-outline dark:border-outline-dark border-b">
            <td class="py-1 pr-2 font-semibold whitespace-nowrap tabular-nums">
              {pointLabel(shownIndex, shownEntry)}
            </td>
            {#each metrics as metric (metric.key)}
              <th scope="col" class="px-2 py-1 text-right font-medium">{metric.label()}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each SIDES as side (side)}
            <tr>
              <th scope="row" class="py-1 pr-2 text-left font-medium whitespace-nowrap">
                {seatLabel(side)}
              </th>
              {#each metrics as metric (metric.key)}
                <td class="px-2 py-1">
                  <span class="flex items-center justify-end gap-2">
                    <span class="bg-player-card-surface inline-flex rounded p-1">
                      <svg
                        width={HISTORY_CHART_LEGEND_LINE_PX}
                        height={HISTORY_CHART_LINE_WIDTH_PX}
                      >
                        <line
                          x1="0"
                          y1={HISTORY_CHART_LINE_WIDTH_PX / 2}
                          x2={HISTORY_CHART_LEGEND_LINE_PX}
                          y2={HISTORY_CHART_LINE_WIDTH_PX / 2}
                          class={lineClass(side)}
                          stroke-width={HISTORY_CHART_LINE_WIDTH_PX}
                          stroke-dasharray={metric.dashed ? HISTORY_CHART_DASH_ARRAY : undefined}
                        />
                      </svg>
                    </span>
                    <span class="font-semibold tabular-nums">{shownEntry[metric.key][side]}</span>
                  </span>
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}

    <div bind:clientWidth={width}>
      {#if width > 0}
        <svg
          bind:this={svg}
          {width}
          height={HISTORY_CHART_HEIGHT_PX}
          class="block text-xs select-none"
          role="img"
          aria-label={chartMode.label()}
        >
          <rect
            x={plotLeft}
            y={plotTop}
            width={plotWidth}
            height={plotBottom - plotTop}
            class="fill-player-card-surface"
          />

          {#if chartMode.axisTitles.left}
            <text
              x="0"
              y={plotTop - HISTORY_CHART_AXIS_TITLE_GAP_PX}
              class="fill-onsurface dark:fill-onsurface-dark font-semibold"
              >{chartMode.axisTitles.left()}</text
            >
          {/if}
          {#if chartMode.axisTitles.right}
            <text
              x={width}
              y={plotTop - HISTORY_CHART_AXIS_TITLE_GAP_PX}
              text-anchor="end"
              class="fill-onsurface dark:fill-onsurface-dark font-semibold"
              >{chartMode.axisTitles.right()}</text
            >
          {/if}

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
            class="fill-onsurface dark:fill-onsurface-dark font-semibold"
            >{m.history_turn_label()}</text
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

          {#if activeEntry && activeIndex !== null}
            <line
              x1={xAt(activeIndex)}
              x2={xAt(activeIndex)}
              y1={plotTop}
              y2={plotBottom}
              class="stroke-onsurface dark:stroke-onsurface-dark"
            />
            {#each metrics as metric (metric.key)}
              {#each SIDES as side (side)}
                <circle
                  cx={xAt(activeIndex)}
                  cy={yAt(metric.axis, activeEntry[metric.key][side])}
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
            onpointerdown={handlePointerDown}
            onpointermove={handlePointerMove}
            onpointerleave={handlePointerLeave}
          />
        </svg>
      {/if}
    </div>
  </div>
</div>
