<template>
  <div class="home">
    <form id="app" @submit="checkForm">
      <input type="number" id="layer" v-model="inputLayer" min="1" step="1" />
      <input type="submit" value="Change" />
    </form>
    <layered-hexagon-panels :layer="layer" />
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import LayeredHexagonPanels from "@/components/LayeredHexagonPanels.vue";

export default defineComponent({
  components: { LayeredHexagonPanels },
  data() {
    return {
      inputLayer: 5,
      layer: 5,
    };
  },
  methods: {
    checkForm(e: Event) {
      e.preventDefault();
      this.layer = this.inputLayer;
    },
  },
});
</script>
