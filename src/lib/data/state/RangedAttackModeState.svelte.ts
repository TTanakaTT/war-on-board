let _active = $state(false);

function set(active: boolean) {
  _active = active;
}

function isActive(): boolean {
  return _active;
}

export const rangedAttackModeState = {
  set,
  isActive,
};
