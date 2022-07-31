<template>
  <div class="hexagon-panel" :class="getClass">
    <transition-group name="pieces">
      <v-icon v-for="piece in showPieces" :key="piece">{{ piece }}</v-icon>
    </transition-group>
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
    getClass(): string[] {
      const states: panelState[] = this.$store.getters[
        "panels/getThisPanelStates"
      ](this.horizontalLayer, this.verticalLayer);
      let state: string;
      if (states.length !== 0) {
        state = states[0];
      } else if (this.showPieces.length !== 0) {
        state = PANELSTATE.OCCUPIED;
      } else {
        state = PANELSTATE.UNOCCUPIED;
      }
      // BUG: .value returns undefined
      return [this.$vuetify.theme.name as unknown as string, state];
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
$background-color-dark-unoccupied: rgb(58, 58, 50);
$background-color-dark-unoccupied-hover: rgb(134, 134, 122);
$background-color-dark-selected: rgb(177, 177, 137);
$background-color-dark-selected-hover: rgb(218, 218, 167);
$background-color-dark-movable: rgb(95, 95, 79);
$background-color-dark-movable-hover: rgb(143, 143, 107);
$background-color-dark-immovable: rgb(43, 43, 40);

$background-color-light-unoccupied: rgb(233, 247, 230);
$background-color-light-unoccupied-hover: rgb(251, 254, 250);
$background-color-light-selected: rgb(170, 231, 154);
$background-color-light-selected-hover: rgb(240, 249, 238);
$background-color-light-movable: rgb(211, 241, 203);
$background-color-light-movable-hover: $background-color-light-selected-hover;
$background-color-light-immovable: rgb(255, 255, 255);

.pieces-enter-active,
.pieces-leave-active {
  transition: all 0.5s ease;
}
.pieces-enter-from,
.pieces-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

.hexagon-panel {
  transition: all 0.2s ease-in;
  transition: all 0.4s ease-out;
  position: relative;
  height: $height;
  width: math.div($height, $sqrt3);
  border-top: $border-style;
  border-bottom: $border-style;
  margin: $height * 0.1 0;

  &:before,
  &:after {
    transition: all 0.2s ease-in;
    transition: all 0.4s ease-out;
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

  &:hover {
    transition: all 0.1s ease-in;
    transition: all 0.1s ease-out;
    &:before,
    &:after {
      transition: all 0.1s ease-in;
      transition: all 0.1s ease-out;
    }
  }
  &.unoccupied {
    pointer-events: none;
    &.dark {
      background-color: $background-color-dark-unoccupied;
      &:before,
      &:after {
        background-color: $background-color-dark-unoccupied;
      }
    }
    &.light {
      background-color: $background-color-light-unoccupied;
      &:before,
      &:after {
        background-color: $background-color-light-unoccupied;
      }
    }
  }
  &.occupied {
    cursor: pointer;
    &.dark {
      background-color: $background-color-dark-unoccupied;
      &:before,
      &:after {
        background-color: $background-color-dark-unoccupied;
      }
      &:hover {
        background-color: $background-color-dark-unoccupied-hover;
        &:before,
        &:after {
          background-color: $background-color-dark-unoccupied-hover;
        }
      }
    }
    &.light {
      background-color: $background-color-light-unoccupied;
      &:before,
      &:after {
        background-color: $background-color-light-unoccupied;
      }
      &:hover {
        background-color: $background-color-light-unoccupied-hover;
        &:before,
        &:after {
          background-color: $background-color-light-unoccupied-hover;
        }
      }
    }
  }
  &.selected {
    cursor: pointer;
    &.dark {
      background-color: $background-color-dark-selected;
      &:before,
      &:after {
        background-color: $background-color-dark-selected;
      }
      &:hover {
        background-color: $background-color-dark-selected-hover;
        &:before,
        &:after {
          background-color: $background-color-dark-selected-hover;
        }
      }
    }
    &.light {
      background-color: $background-color-light-selected;
      &:before,
      &:after {
        background-color: $background-color-light-selected;
      }
      &:hover {
        background-color: $background-color-light-selected-hover;
        &:before,
        &:after {
          background-color: $background-color-light-selected-hover;
        }
      }
    }
  }
  &.movable {
    cursor: pointer;
    &.dark {
      background-color: $background-color-dark-movable;
      &:before,
      &:after {
        background-color: $background-color-dark-movable;
      }
      &:hover {
        background-color: $background-color-dark-movable-hover;
        &:before,
        &:after {
          background-color: $background-color-dark-movable-hover;
        }
      }
    }
    &.light {
      background-color: $background-color-light-movable;
      &:before,
      &:after {
        background-color: $background-color-light-movable;
      }
      &:hover {
        background-color: $background-color-light-movable-hover;
        &:before,
        &:after {
          background-color: $background-color-light-movable-hover;
        }
      }
    }
  }
  &.immovable {
    pointer-events: none;
    &.dark {
      background-color: $background-color-dark-immovable;
      &:before,
      &:after {
        background-color: $background-color-dark-immovable;
      }
    }
    &.light {
      background-color: $background-color-light-immovable;
      &:before,
      &:after {
        background-color: $background-color-light-immovable;
      }
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
