import { Module } from "vuex";
import { Piece } from "@/interfaces/Piece";

import { RootState } from "./index";

interface PieceState {
  pieces: Piece[];
}

const piecesStoreModule: Module<PieceState, RootState> = {
  namespaced: true,
  state: {
    pieces: [],
  },
  getters: {
    getThisPieceNames:
      (state) => (horizontalLayer: number, verticalLayer: number) => {
        if (state.pieces.length === 0) {
          return [];
        }
        return state.pieces
          .filter(
            (x) =>
              x.horizontalLayer === horizontalLayer &&
              x.verticalLayer === verticalLayer
          )
          .map((y) => y.pieceName);
      },
  },
  mutations: {
    create(state, piece: Piece): void {
      state.pieces.push(piece);
    },
    delete(state, piece: Piece): void {
      const index: number = state.pieces.findIndex(
        ({ horizontalLayer, verticalLayer, pieceName }) =>
          horizontalLayer === piece.horizontalLayer &&
          verticalLayer === piece.verticalLayer &&
          pieceName === piece.pieceName
      );
      state.pieces.splice(index, 1);
    },
  },
  actions: {
    create({ commit }, piece: Piece): void {
      commit("create", piece);
    },
    delete({ commit }, piece: Piece): void {
      commit("delete", piece);
    },
  },
};

export default piecesStoreModule;
