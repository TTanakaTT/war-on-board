<template>
  <div class="hexagon-panels">
    <div class="hexagon"></div>
  </div>
  <div class="hexagon-panels alt">
    <div class="hexagon"></div>
  </div>
</template>
<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
  name: "hexagonPanel",
  props: { layer: { type: Number, default: 1 } },
});
</script>
<style lang="scss" scoped>
// ref: https://codepen.io/raccy/pen/xBKBew

$height: 100px; // .alt`s height: $height * $sqrt3 / 2
$sqrt3: 1.7320508;
$border-size: 1px;
$border-style: solid $border-size black;
$background-color: yellow;

.hexagon-panels {
  padding-left: $height / $sqrt3 / 2;

  .hexagon {
    position: relative;
    height: $height;
    width: $height / $sqrt3;
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
      width: $height / $sqrt3;
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
}

.hexagon-panels.alt {
  padding-left: $height * $sqrt3 / 4 - $height / 4;
  padding-top: $height / 2 - $height * $sqrt3 / 4;
  padding-bottom: $height / 2 - $height * $sqrt3 / 4;

  .hexagon {
    height: $height * $sqrt3 / 2;
    width: $height / 2;
    transform: rotate(30deg);

    &:before,
    &:after {
      height: $height * $sqrt3 / 2;
      width: $height / 2;
    }
  }
}
</style>
