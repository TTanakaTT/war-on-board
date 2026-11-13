// PROTOTYPE ONLY (#45): cycles through selected-piece highlight variants.
export type HighlightMode = "border2" | "border3";

const MODES: HighlightMode[] = ["border2", "border3"];
const LABELS: Record<HighlightMode, string> = {
  border2: "枠 2px + 拡大",
  border3: "枠 3px + 拡大",
};

let mode = $state<HighlightMode>("border2");

export const ProtoHighlightMode = {
  get: (): HighlightMode => mode,
  label: (): string => LABELS[mode],
  toggle: (): void => {
    mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
  },
};
