<script lang="ts">
  import { BoardLayout } from "$lib/presentation/BoardLayout";

  type Props = {
    polygonClass: string;
    strokeClass: string;
    strokeDasharray?: string;
    onClick: () => void;
  };

  const SVG_HEIGHT = BoardLayout.HEIGHT;
  const SVG_WIDTH = BoardLayout.horizontalSideLength * 2;
  const HALF_SIDE = BoardLayout.horizontalSideLength / 2;
  const FULL_SIDE = BoardLayout.horizontalSideLength;
  const ONE_AND_HALF_SIDE = BoardLayout.horizontalSideLength * 1.5;
  const HEXAGON_POINTS = `${HALF_SIDE},0 ${ONE_AND_HALF_SIDE},0 ${SVG_WIDTH},${SVG_HEIGHT / 2} ${ONE_AND_HALF_SIDE},${SVG_HEIGHT} ${HALF_SIDE},${SVG_HEIGHT} 0,${SVG_HEIGHT / 2}`;

  let { polygonClass, strokeClass, strokeDasharray, onClick }: Props = $props();

  const svgStyle = `width: ${SVG_WIDTH}px; height: ${SVG_HEIGHT}px;`;
</script>

<svg
  class="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 overflow-visible"
  style={svgStyle}
  viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
  aria-hidden="true"
>
  <polygon
    points={HEXAGON_POINTS}
    class="pointer-events-auto {polygonClass} {strokeClass}"
    stroke-dasharray={strokeDasharray}
    stroke-linejoin="round"
    vector-effect="non-scaling-stroke"
    onclick={onClick}
  />
</svg>
