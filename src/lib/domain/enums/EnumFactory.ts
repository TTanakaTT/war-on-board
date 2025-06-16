/* eslint-disable @typescript-eslint/no-explicit-any */
export function EnumClass<T extends Record<string, string>>(enumObj: T) {
	type _enumType = (typeof enumObj)[keyof typeof enumObj];

	return function <C extends new (...args: any[]) => object>(constructor: C) {
		return class extends constructor {
			// 元のenumの各値に対応する静的プロパティを作成
			static {
				Object.entries(enumObj).forEach(([key, value]) => {
					// クラス自身に静的プロパティとしてインスタンスを追加
					Object.defineProperty(this, key, {
						value: new this(value),
						writable: false,
						enumerable: true,
						configurable: false
					});
				});
			}

			// インスタンスのvalue保持用
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
