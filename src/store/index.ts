import { createStore } from "vuex";
import piecesStoreModule from "@/store/piecesStoreModule";

const rootState = {
  count: 0,
};

export type RootState = typeof rootState;

export default createStore({
  state: rootState,
  modules: { pieces: piecesStoreModule },
});
