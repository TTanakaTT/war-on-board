<template>
  <navigation-header />
  <router-view />
</template>

<script lang="ts">
import { defineComponent } from "vue";
import navigationHeader from "@/components/navigationHeader.vue";

export default defineComponent({
  name: "App",
  components: { navigationHeader }
});
</script>

<style lang="scss" scoped>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
}
</style>
