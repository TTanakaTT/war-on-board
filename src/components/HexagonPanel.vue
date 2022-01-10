<template>
  <div class="hexagon-panel" :class="showState">
    <v-icon v-for="piece in showPieces" :key="piece">{{ piece }}</v-icon>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { panelState, PANELSTATE } from "@/enums/PanelStates";
export default defineComponent({
  props: {
    horizontalLayer: { type: Number, required: true },
    verticalLayer: { type: Number, required: true },
  },
  computed: {
    showPieces(): string[] {
      return this.$store.getters["pieces/getThisPieceNames"](
        this.horizontalLayer,
        this.verticalLayer
      );
    },
    showState(): panelState {
      const states: panelState[] = this.$store.getters[
        "panels/getThisPanelStates"
      ](this.horizontalLayer, this.verticalLayer);
      if (states.length !== 0) {
        return states[0];
      } else if (this.showPieces.length !== 0) {
        return PANELSTATE.ENABLED;
      } else {
        return PANELSTATE.NORMAL;
      }
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
$background-color-normal: rgb(58, 58, 50);
$background-color-normal-hover: rgb(134, 134, 122);
$background-color-selected: rgb(177, 177, 137);
$background-color-selected-hover: rgb(197, 197, 100);
$background-color-move-candidated: rgb(95, 95, 79);
$background-color-move-candidated-hover: rgb(143, 143, 107);
$background-color-disabled: rgb(43, 43, 40);

.hexagon-panel {
  position: relative;
  height: $height;
  width: math.div($height, $sqrt3);
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
    border-top: $border-style;
    border-bottom: $border-style;
  }
  &:before {
    transform: rotate(60deg);
  }
  &:after {
    transform: rotate(-60deg);
  }

  &.normal {
    pointer-events: none;
    background-color: $background-color-normal;
    &:before,
    &:after {
      background-color: $background-color-normal;
    }
  }
  &.enabled {
    background-color: $background-color-normal;
    cursor: pointer;
    &:before,
    &:after {
      background-color: $background-color-normal;
    }
    &:hover {
      background-color: $background-color-normal-hover;
      &:before,
      &:after {
        background-color: $background-color-normal-hover;
      }
    }
  }
  &.selected {
    background-color: $background-color-selected;
    cursor: pointer;
    &:before,
    &:after {
      background-color: $background-color-selected;
    }
    &:hover {
      background-color: $background-color-selected-hover;
      &:before,
      &:after {
        background-color: $background-color-selected-hover;
      }
    }
  }
  &.move-candidated {
    background-color: $background-color-move-candidated;
    cursor: pointer;
    &:before,
    &:after {
      background-color: $background-color-move-candidated;
    }
    &:hover {
      background-color: $background-color-move-candidated-hover;
      &:before,
      &:after {
        background-color: $background-color-move-candidated-hover;
      }
    }
  }
  &.disabled {
    background-color: $background-color-disabled;
    pointer-events: none;
    &:before,
    &:after {
      background-color: $background-color-disabled;
    }
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
