import { panelState } from "@/enums/PanelStates";

export interface Panel {
  horizontalLayer: number;
  verticalLayer: number;
  state: panelState;
}
