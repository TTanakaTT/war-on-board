<template>
  <div class="hexagon-panel"></div>
</template>
<style lang="scss" scoped>
@use "sass:math";
// ref: https://codepen.io/raccy/pen/xBKBew

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
