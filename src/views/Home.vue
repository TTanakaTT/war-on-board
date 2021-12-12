<template>
  <div class="home">
    <input type="number" id="layer" v-model="layer" min="1" step="1" />
    <hexagon-panels :layer="layer" />
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
