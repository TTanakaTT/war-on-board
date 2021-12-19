<template>
  <v-app id="inspire">
    <v-navigation-drawer v-model="drawer" app style="z-index: 900">
      <v-list-item>
        <v-list-item-title class="text-h6"> Application </v-list-item-title>
        <v-list-item-subtitle> subtext </v-list-item-subtitle>
      </v-list-item>
      <v-divider></v-divider>
      <v-list dense nav>
        <router-link to="/">
          <v-list-item>
            <v-icon>mdi-view-dashboard</v-icon>
            <v-list-item-title>Home</v-list-item-title>
          </v-list-item>
        </router-link>
      </v-list>
      <v-list dense nav>
        <router-link to="/">
          <v-list-item>
            <v-icon>mdi-help-box</v-icon>
            <v-list-item-title>Help</v-list-item-title>
          </v-list-item>
        </router-link>
      </v-list>
    </v-navigation-drawer>

    <v-app-bar app>
      <v-app-bar-title>Application !!!!!!!!!!!</v-app-bar-title>
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
    const drawer = false;
    return {
      drawer,
    };
  },
});
</script>
