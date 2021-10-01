<template>
  <div class="home"></div>
  <hexagon-panels :layer="4" />
</template>

<script lang="ts">
import { defineComponent } from "vue";
import HexagonPanels from "@/components/HexagonPanels.vue";

export default defineComponent({
  components: { HexagonPanels },
});
</script>
