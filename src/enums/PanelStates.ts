export enum PANELSTATE {
  NORMAL = "normal",
  ENABLED = "enabled",
  SELECTED = "selected",
  MOVE_CANDIDATED = "move-candidated",
  DISABLED = "disabled",
}
export type panelState = typeof PANELSTATE[keyof typeof PANELSTATE];
