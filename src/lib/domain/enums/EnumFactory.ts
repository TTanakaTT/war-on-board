export function EnumClass<T extends Record<string, string>>(enumObj: T) {
  type _enumType = (typeof enumObj)[keyof typeof enumObj];

  return function <C extends new (value: _enumType) => object>(constructor: C): void {
    Object.entries(enumObj).forEach(([key, value]) => {
      Object.defineProperty(constructor, key, {
        value: new constructor(value as _enumType),
        writable: false,
        enumerable: true,
        configurable: false,
      });
    });

    Object.defineProperty(constructor.prototype, Symbol.toPrimitive, {
      value(this: object): string {
        return (this as { _value: _enumType })._value;
      },
      writable: false,
      enumerable: false,
      configurable: false,
    });
  };
}
