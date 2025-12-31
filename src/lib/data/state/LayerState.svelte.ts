let _layer = $state<number>(1);

function set(layer: number) {
  _layer = layer;
}

function get(): number {
  return _layer;
}

export const layerState = {
  set,
  get,
};
