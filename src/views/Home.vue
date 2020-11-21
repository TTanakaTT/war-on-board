<template>
  <div class="home"></div>
  <hexagon-panel />
</template>

<script lang="ts">
import { defineComponent } from "vue";
import hexagonPanel from "@/components/hexagonPanel.vue";

export default defineComponent({
  name: "Home",
  components: {
    hexagonPanel,
  },
});
</script>
