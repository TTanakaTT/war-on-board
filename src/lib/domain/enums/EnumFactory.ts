/* eslint-disable @typescript-eslint/no-explicit-any */
export function EnumClass<T extends Record<string, string>>(enumObj: T) {
  type _enumType = (typeof enumObj)[keyof typeof enumObj];

  return function <C extends new (...args: any[]) => object>(constructor: C) {
    return class extends constructor {
      // Create static properties corresponding to each value of the original enum
      static {
        Object.entries(enumObj).forEach(([key, value]) => {
          // Add instances as static properties on the class itself
          Object.defineProperty(this, key, {
            value: new this(value),
            writable: false,
            enumerable: true,
            configurable: false,
          });
        });
      }

      // Holds the enum value for this instance
      private readonly _value: _enumType;

      constructor(...args: any[]) {
        super(...args);
        this._value = args[0];
      }

      [Symbol.toPrimitive](): string {
        return this._value;
      }
    };
  };
}
