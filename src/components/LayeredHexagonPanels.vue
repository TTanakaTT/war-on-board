<template>
  <div class="layered-hexagon-panels">
    <div
      v-for="hl in sideRange"
      :key="hl"
      class="horizontal-layer"
      :style="horizontalStyle(hl)"
    >
      <div v-for="vl of layer - Math.abs(hl)" :key="vl" class="vertical-layer">
        <hexagon-panel :horizontalLayer="hl" :verticalLayer="vl" />
      </div>
    </div>
  </div>
</template>
<script lang="ts">
import { defineComponent } from "vue";
import { CssVariable } from "@/interfaces/CssVariable";
import HexagonPanel from "@/components/HexagonPanel.vue";

export default defineComponent({
  components: { HexagonPanel },
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
    horizontalStyle(horizontalLayer: number): CssVariable {
      const height = 100;
      const left: number =
        ((height * Math.sqrt(3)) / 2) * 1.1 * horizontalLayer -
        (height / Math.sqrt(3)) * (this.layer + horizontalLayer) +
        height / Math.sqrt(3) / 2;
      const top: number = Math.abs(horizontalLayer) * (height * 0.5) * 1.1;

      return {
        "--left": left.toString() + "px",
        "--top": top.toString() + "px",
      };
    },
  },
});
</script>
<style lang="scss" scoped>
@use "sass:math";
// ref: https://codepen.io/raccy/pen/xBKBew
.layered-hexagon-panels {
  position: relative;
  left: 50%;
  .horizontal-layer {
    float: left;
    position: relative;
    left: var(--left);
    top: var(--top);
    --left: 0;
    --top: 0;
  }
}
</style>
