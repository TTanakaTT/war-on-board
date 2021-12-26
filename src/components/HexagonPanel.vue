<template>
  <div class="hexagon-panel" @click="change">
    <v-icon v-for="piece in showPieces" :key="piece">{{ piece }}</v-icon>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { Piece } from "@/interfaces/Piece";
export default defineComponent({
  props: {
    horizontalLayer: { type: Number, default: 1 },
    verticalLayer: { type: Number, default: 1 },
  },
  methods: {
    change() {
      const pieceNames: string[] = this.getPieceNames();
      let pieceName = "mdi-chess-knight";
      let storeAction = "pieces/create";

      if (pieceNames.length > 0) {
        pieceName = pieceNames[0];
        storeAction = "pieces/delete";
      } else {
        pieceName = "mdi-chess-knight";
        storeAction = "pieces/create";
      }

      const piece: Piece = {
        horizontalLayer: this.horizontalLayer,
        verticalLayer: this.verticalLayer,
        pieceName: pieceName,
      };
      this.$store.dispatch(storeAction, piece);
    },
    getPieceNames(): string[] {
      return this.$store.getters["pieces/getThisPieceNames"](
        this.horizontalLayer,
        this.verticalLayer
      );
    },
  },
  computed: {
    showPieces(): string[] {
      return this.getPieceNames();
    },
  },
});
</script>
<style lang="scss" scoped>
@use "sass:math";
// ref: https://codepen.io/raccy/pen/xBKBew

.v-icon {
  margin: 5%;
  width: 90%;
  height: 90%;
  position: absolute;
  z-index: 1;
}

$height: 100px; // .alt`s height: $height * $sqrt3 / 2
$sqrt3: 1.73;
$border-size: 1px;
$border-style: solid $border-size black;
$background-color: rgb(51, 51, 47);

.hexagon-panel {
  position: relative;
  height: $height;
  width: math.div($height, $sqrt3);
  background-color: $background-color;
  border-top: $border-style;
  border-bottom: $border-style;
  margin: $height * 0.1 0;

  &:before,
  &:after {
    content: "";
    position: absolute;
    top: -$border-size;
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
.hexagon-panel.alt {
  height: math.div($height * $sqrt3, 2);
  width: math.div($height, 2);
  transform: rotate(30deg);

  &:before,
  &:after {
    height: math.div($height * $sqrt3, 2);
    width: math.div($height, 2);
  }
}
</style>
