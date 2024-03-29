import { Module } from "vuex";
import { Panel } from "@/interfaces/Panel";

import { RootState } from "./index";
import { panelState, PANELSTATE } from "@/enums/PanelStates";

interface PanelState {
  panels: Panel[];
}

const panelsStoreModule: Module<PanelState, RootState> = {
  namespaced: true,
  state: {
    panels: [],
  },
  getters: {
    getThisPanelStates:
      (state) => (horizontalLayer: number, verticalLayer: number) => {
        if (state.panels.length === 0) {
          return [];
        }
        const panelStates: panelState[] = state.panels
          .filter(
            (x) =>
              x.horizontalLayer === horizontalLayer &&
              x.verticalLayer === verticalLayer
          )
          .map((y) => y.state);
        const isMoveCandidated =
          state.panels.filter(
            (x) =>
              !(
                x.horizontalLayer === horizontalLayer &&
                x.verticalLayer === verticalLayer
              ) &&
              x.horizontalLayer - horizontalLayer >= -1 &&
              x.horizontalLayer - horizontalLayer <= 1 &&
              x.verticalLayer - verticalLayer >= -1 &&
              x.verticalLayer - verticalLayer <= 1 &&
              Math.abs(x.horizontalLayer) -
                Math.abs(horizontalLayer) +
                x.verticalLayer -
                verticalLayer >=
                -1 &&
              Math.abs(x.horizontalLayer) -
                Math.abs(horizontalLayer) +
                x.verticalLayer -
                verticalLayer <=
                1 &&
              x.state === PANELSTATE.SELECTED
          ).length > 0;
        const isNotSelected =
          state.panels.filter(
            (x) =>
              !(
                x.horizontalLayer === horizontalLayer &&
                x.verticalLayer === verticalLayer
              ) && x.state === PANELSTATE.SELECTED
          ).length > 0;
        if (isMoveCandidated) {
          panelStates.push(PANELSTATE.MOVE_CANDIDATED);
        } else if (isNotSelected) {
          panelStates.push(PANELSTATE.DISABLED);
        }
        panelStates.sort();
        return panelStates;
      },
  },
  mutations: {
    update(state, panel: Panel): void {
      const thisPanelIndex = state.panels.findIndex(
        (x) =>
          x.horizontalLayer === panel.horizontalLayer &&
          x.verticalLayer === panel.verticalLayer
      );
      const isPanelExisted = thisPanelIndex >= 0;
      const isNormal = panel.state === PANELSTATE.NORMAL;
      if (isPanelExisted && isNormal) {
        state.panels.splice(thisPanelIndex, 1);
      } else if (isPanelExisted && !isNormal) {
        state.panels[thisPanelIndex].state = panel.state;
      } else if (!isPanelExisted && !isNormal) {
        state.panels.push(panel);
      }
    },
    delete(state, panel: Panel): void {
      const index: number = state.panels.findIndex(
        ({ horizontalLayer, verticalLayer, state }) =>
          horizontalLayer === panel.horizontalLayer &&
          verticalLayer === panel.verticalLayer &&
          state === panel.state
      );
      state.panels.splice(index, 1);
    },
  },
  actions: {
    update({ commit }, panel: Panel): void {
      commit("update", panel);
    },
    delete({ commit }, panel: Panel): void {
      commit("delete", panel);
    },
  },
};

export default panelsStoreModule;
