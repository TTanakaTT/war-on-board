export class PanelPosition {
	horizontalLayer: number;
	verticalLayer: number;
	constructor({
		horizontalLayer,
		verticalLayer
	}: {
		horizontalLayer: number;
		verticalLayer: number;
	}) {
		this.horizontalLayer = horizontalLayer;
		this.verticalLayer = verticalLayer;
	}
	equals(other: PanelPosition): boolean {
		return (
			this.horizontalLayer === other.horizontalLayer && this.verticalLayer === other.verticalLayer
		);
	}
	isAdjacent(other: PanelPosition): boolean {
		return (
			!this.equals(other) &&
			Math.abs(this.horizontalLayer - other.horizontalLayer) <= 1 &&
			Math.abs(this.verticalLayer - other.verticalLayer) <= 1 &&
			Math.abs(
				Math.abs(this.horizontalLayer) -
					Math.abs(other.horizontalLayer) +
					this.verticalLayer -
					other.verticalLayer
			) <= 1
		);
	}
}
