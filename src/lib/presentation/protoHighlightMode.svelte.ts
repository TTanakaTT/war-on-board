// PROTOTYPE ONLY (#45): toggles between selected-piece highlight variants.
export type HighlightMode = "ring" | "scale";

let mode = $state<HighlightMode>("ring");

export const ProtoHighlightMode = {
  get: (): HighlightMode => mode,
  toggle: (): void => {
    mode = mode === "ring" ? "scale" : "ring";
  },
};
