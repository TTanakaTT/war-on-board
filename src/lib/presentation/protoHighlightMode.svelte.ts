// PROTOTYPE ONLY (#45): cycles through selected-piece highlight variants.
export type HighlightMode = "ring2" | "ring3" | "ring4" | "scale";

const MODES: HighlightMode[] = ["ring2", "ring3", "ring4", "scale"];
const LABELS: Record<HighlightMode, string> = {
  ring2: "枠線 2px",
  ring3: "枠線 3px",
  ring4: "枠線 4px",
  scale: "拡大",
};

let mode = $state<HighlightMode>("ring2");

export const ProtoHighlightMode = {
  get: (): HighlightMode => mode,
  label: (): string => LABELS[mode],
  toggle: (): void => {
    mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
  },
};
