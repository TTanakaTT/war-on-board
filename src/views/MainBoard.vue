<template>
  <div class="home">
    <input type="number" id="layer" v-model="layer" min="1" step="1" />
    <layered-hexagon-panels :layer="layer" />
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import LayeredHexagonPanels from "@/components/LayeredHexagonPanels.vue";

export default defineComponent({
  components: { LayeredHexagonPanels },
  data() {
    const layer = 5;
    return {
      layer,
    };
  },
});
</script>
