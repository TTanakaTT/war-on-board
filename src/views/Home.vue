<template>
  <div class="home">
    <hexagon-panels :layer="layer" />
    <input type="number" id="layer" v-model="layer" />
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import HexagonPanels from "@/components/HexagonPanels.vue";

export default defineComponent({
  components: { HexagonPanels },
  data() {
    const layer = 1;
    return {
      layer,
    };
  },
});
</script>
