<template>
  <div class="hexagon-panels">
    <div
      v-for="hl in sideRange"
      :key="hl"
      class="horizon-layer"
      :style="horizonStyle(hl)"
    >
      <div
        v-for="vl of layer - Math.abs(hl)"
        :key="vl"
        class="vertical-layer"
        :style="verticalStyle(hl, vl)"
      >
        <div class="hexagon" />
      </div>
    </div>
  </div>
</template>
<script lang="ts">
import { defineComponent } from "vue";
import { CssVariable } from "@/interfaces/CssVariable";

export default defineComponent({
  props: { layer: { type: Number, default: 1 } },
  computed: {
    sideRange(): number[] {
      const horizontalLayer = this.layer;
      const range = [];
      for (let i = -(horizontalLayer - 1); i < horizontalLayer; i++) {
        range.push(i);
      }
      return range;
    },
  },
  methods: {
    horizonStyle(horizontalLayer: number): CssVariable {
      return {
        "--left": ((173.20508 / 2) * 1.1 * horizontalLayer).toString() + "px",
      };
    },
    verticalStyle(horizontalLayer: number, verticalLayer: number): CssVariable {
      return {
        "--top":
          (
            100 *
            1.1 *
            (verticalLayer - 1 + 0.5 * Math.abs(horizontalLayer))
          ).toString() + "px",
      };
    },
  },
});
</script>
<style lang="scss" scoped>
@use "sass:math";
// ref: https://codepen.io/raccy/pen/xBKBew

$height: 100px; // .alt`s height: $height * $sqrt3 / 2
$sqrt3: 1.7320508;
$border-size: 1px;
$border-style: solid $border-size black;
$background-color: rgb(206, 216, 218);

.hexagon-panels {
  position: relative;
  padding-left: math.div(math.div($height, $sqrt3), 2);
  left: 50vw;

  .horizon-layer {
    left: var(--left);
    position: absolute;
    --left: 0;
  }
  .vertical-layer {
    top: var(--top);
    position: absolute;
    --top: 0;
  }
  .hexagon {
    position: relative;
    height: $height;
    width: math.div($height, $sqrt3);
    left: math.div(-$height, $sqrt3);
    background-color: $background-color;
    border-top: $border-style;
    border-bottom: $border-style;

    &:before,
    &:after {
      content: "";
      position: absolute;
      top: -$border-size;
      left: 0;
      height: $height;
      width: math.div($height, $sqrt3);
      background-color: $background-color;
      border-top: $border-style;
      border-bottom: $border-style;
    }
    &:before {
      transform: rotate(60deg);
    }
    &:after {
      transform: rotate(-60deg);
    }
  }

  .hexagon-panels.alt {
    padding-left: math.div($height * $sqrt3, 4) - math.div($height, 4);
    padding-top: math.div($height, 2) - math.div($height * $sqrt3, 4);
    padding-bottom: math.div($height, 2) - math.div($height * $sqrt3, 4);

    .hexagon {
      height: math.div($height * $sqrt3, 2);
      width: math.div($height, 2);
      transform: rotate(30deg);

      &:before,
      &:after {
        height: math.div($height * $sqrt3, 2);
        width: math.div($height, 2);
      }
    }
  }
}
</style>
