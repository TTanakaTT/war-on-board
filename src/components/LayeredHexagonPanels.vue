<template>
  <div class="layered-hexagon-panels">
    <div>
      <v-btn rounded color="primary" @click="generate">Generate</v-btn>
    </div>
    <div
      v-for="hl in sideRange"
      :key="hl"
      class="horizontal-layer"
      :style="horizontalStyle(hl)"
    >
      <div v-for="vl of layer - Math.abs(hl)" :key="vl" class="vertical-layer">
        <hexagon-panel
          :horizontalLayer="hl"
          :verticalLayer="vl"
          @click="panelChange(hl, vl)"
        />
      </div>
    </div>
  </div>
</template>
<script lang="ts">
import { defineComponent } from "vue";
import { CssVariable } from "@/interfaces/CssVariable";
import HexagonPanel from "@/components/HexagonPanel.vue";
import { Piece } from "@/interfaces/Piece";
import { Panel } from "@/interfaces/Panel";
import { panelState, PANELSTATE } from "@/enums/PanelStates";

export default defineComponent({
  components: { HexagonPanel },
  props: {
    layer: {
      type: Number,
      default: 1,
      validator: (value: number) => {
        return value >= 1 && Number.isInteger(value);
      },
    },
  },
  data() {
    const selectedPanel: Panel = {
      horizontalLayer: 1,
      verticalLayer: 1,
      state: PANELSTATE.SELECTED,
    };
    return { selectedPanel };
  },
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
        (height / Math.sqrt(3)) * (Number(this.layer) + horizontalLayer) +
        height / Math.sqrt(3) / 2;
      const top: number = Math.abs(horizontalLayer) * (height * 0.5) * 1.1;
      return {
        "--left": left.toString() + "px",
        "--top": top.toString() + "px",
      };
    },
    generate(): void {
      this.pieceChange(-(this.layer - 1), 1);
    },
    panelChange(horizontalLayer: number, verticalLayer: number): void {
      const state: panelState = this.getState(horizontalLayer, verticalLayer);
      this.stateChange(horizontalLayer, verticalLayer);
      switch (state) {
        case undefined:
          this.selectedPanel = {
            horizontalLayer: horizontalLayer,
            verticalLayer: verticalLayer,
            state: PANELSTATE.UNOCCUPIED,
          };
          break;
        case PANELSTATE.MOVABLE:
          this.pieceChange(
            this.selectedPanel.horizontalLayer,
            this.selectedPanel.verticalLayer
          );
          this.pieceChange(horizontalLayer, verticalLayer);
          break;
      }
    },
    stateChange(horizontalLayer: number, verticalLayer: number): void {
      const state: panelState = this.getState(horizontalLayer, verticalLayer);
      let panel: Panel;
      switch (state) {
        case PANELSTATE.UNOCCUPIED:
          panel = {
            horizontalLayer: horizontalLayer,
            verticalLayer: verticalLayer,
            state: PANELSTATE.SELECTED,
          };
          break;
        case PANELSTATE.SELECTED:
        case PANELSTATE.MOVABLE:
          panel = this.selectedPanel;
          break;
        default:
          panel = {
            horizontalLayer: horizontalLayer,
            verticalLayer: verticalLayer,
            state: PANELSTATE.SELECTED,
          };
      }
      const storeAction = "panels/update";
      this.$store.dispatch(storeAction, panel);
    },
    pieceChange(horizontalLayer: number, verticalLayer: number): void {
      const pieceNames: string[] = this.getPieceNames(
        horizontalLayer,
        verticalLayer
      );
      const isDelete: boolean = pieceNames.length > 0;

      const pieceName: string = isDelete ? pieceNames[0] : "mdi-chess-knight";
      const storeAction: string = isDelete ? "pieces/delete" : "pieces/create";

      const piece: Piece = {
        horizontalLayer: horizontalLayer,
        verticalLayer: verticalLayer,
        pieceName: pieceName,
      };
      this.$store.dispatch(storeAction, piece);
    },
    getPieceNames(horizontalLayer: number, verticalLayer: number): string[] {
      return this.$store.getters["pieces/getThisPieceNames"](
        horizontalLayer,
        verticalLayer
      );
    },
    getState(horizontalLayer: number, verticalLayer: number): panelState {
      return this.$store.getters["panels/getThisPanelStates"](
        horizontalLayer,
        verticalLayer
      )[0];
    },
  },
});
</script>
<style lang="scss" scoped>
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
