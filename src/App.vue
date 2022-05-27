<template>
  <v-app id="inspire" :theme="theme">
    <v-navigation-drawer v-model="drawer" app>
      <router-link to="/">
        <v-list-item>
          <v-list-item-title class="text-h6"> War-on-Board </v-list-item-title>
        </v-list-item>
      </router-link>
      <v-divider />
      <v-list dense nav>
        <router-link to="/">
          <v-list-item>
            <v-icon>mdi-view-dashboard</v-icon>
            <v-list-item-title>Home</v-list-item-title>
          </v-list-item>
        </router-link>
        <router-link to="/">
          <v-list-item>
            <v-icon>mdi-help-box</v-icon>
            <v-list-item-title>Help</v-list-item-title>
          </v-list-item>
        </router-link>
      </v-list>
      <v-divider />
      <v-list-item>
        <v-list-item-title class="text-h6"> Settings </v-list-item-title>
      </v-list-item>
      <v-list dense nav>
        <v-list-item>
          <v-switch
            v-model="theme"
            false-icon="mdi-weather-sunny"
            false-value="light"
            true-icon="mdi-weather-night"
            true-value="dark"
          ></v-switch>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>

    <v-app-bar app>
      <v-app-bar-nav-icon @click="drawer = !drawer"></v-app-bar-nav-icon>
    </v-app-bar>

    <v-main>
      <v-container fluid>
        <router-view />
      </v-container>
    </v-main>
    <v-bottom-navigation shift app>
      <v-btn>
        <span>Video</span>
        <v-icon>mdi-television-play</v-icon>
      </v-btn>
      <v-btn>
        <span>Music</span>
        <v-icon>mdi-music-note</v-icon>
      </v-btn>
      <v-btn>
        <span>Book</span>
        <v-icon>mdi-book</v-icon>
      </v-btn>
      <v-btn>
        <span>Image</span>
        <v-icon>mdi-image</v-icon>
      </v-btn>
    </v-bottom-navigation>
  </v-app>
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
  data() {
    // I wanna use [boolean | null | undefined] type. But when this variable is returned, the type of this variable become [null] even though I declared it as type [boolean | null | undefined]. why?
    let drawer: any = null;
    const theme = "dark";
    return {
      drawer,
      theme,
    };
  },
});
</script>
<style lang="scss" scoped>
.router-link-active {
  color: inherit;
  text-decoration: none;
  .v-list-item-title:not(.text-h6) {
    color: -webkit-link;
    text-decoration: underline;
  }
}
</style>
