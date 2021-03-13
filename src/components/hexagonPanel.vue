<template>
  <div id="hexagon-panel">
    <div class="hexagon"></div>
  </div>
  <div id="hexagon-panel" class="alt">
    <div class="hexagon alt"></div>
  </div>
</template>
<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
  name: "hexagonPanel",
});
</script>
<style lang="scss" scoped>
// ref: https://codepen.io/raccy/pen/xBKBew

$height: 100px;
// .alt: $height * $sqrt3 / 2
$sqrt3: 1.7320508;
$border-size: 1px;
$border-style: solid $border-size black;
$background-color: yellow;

#hexagon-panel {
  padding-left: $height / $sqrt3 / 2;

  &.alt {
    padding-left: $height * $sqrt3 / 4 - $height / 4;
    padding-top: $height / 2 - $height * $sqrt3 / 4;
    padding-bottom: $height / 2 - $height * $sqrt3 / 4;
  }

  .hexagon {
    position: relative;
    z-index: 0;
    height: $height;
    width: $height / $sqrt3;
    background-color: $background-color;
    border-top: $border-style;
    border-bottom: $border-style;

    &.alt {
      height: $height * $sqrt3 / 2;
      width: $height / 2;
      transform: rotate(30deg);

      &:before,
      &:after {
        height: $height * $sqrt3 / 2;
        width: $height / 2;
      }
    }

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
      z-index: -1;
      transform: rotate(60deg);

      &.alt {
        transform: rotate(90deg);
      }
    }

    &:after {
      z-index: -2;
      transform: rotate(-60deg);

      &.alt {
        transform: rotate(-30deg);
      }
    }
  }
}
</style>