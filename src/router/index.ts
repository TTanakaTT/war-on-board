import { createRouter, createWebHistory, RouteRecordRaw } from "vue-router";
import MainBoard from "../views/MainBoard.vue";

const routes: Array<RouteRecordRaw> = [
  {
    path: "/",
    name: "MainBoard",
    component: MainBoard,
  },
];

export default createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes,
});
