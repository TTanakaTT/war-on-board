<template>
  <div class="home"></div>
  <hexagon-panels :layer="4" />
</template>

<script lang="ts">
import { defineComponent } from "vue";
import hexagonPanels from "@/components/hexagonPanels.vue";

export default defineComponent({
  name: "Home",
  components: { hexagonPanels },
});
</script>
