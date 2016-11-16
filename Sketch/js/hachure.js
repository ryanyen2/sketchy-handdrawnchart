define(["./segment"], function (seg) {
	var hachure = function (top, bottom, left, right, gap, sinAngle, cosAngle, tanAngle) {
		this._top = top;
		this._bottom = bottom;
		this._left = left;
		this._right = right;
		this._gap = gap;
		this._sinAngle = sinAngle;
		this._cosAngle = cosAngle;
		this._tanAngle = tanAngle;
		this._pos = null;
		this._deltaX = null;
		this._hGap = null;
		this.initialize();
	};
	hachure.prototype.initialize = function () {
		if (Math.abs(this._sinAngle) < 0.0001) {
			//Special case 1: Vertical lines
			this._pos = this._left + this._gap;
		}
		else if (Math.abs(this._sinAngle) > 0.9999) {
			//Special case 2: Horizontal lines
			this_pos = this._top + this._gap;
		}
		else {
			this._deltaX = (this._bottom - this._top) * Math.abs(this._tanAngle);
			this._pos = this._left - Math.abs(this._deltaX);
			this._hGap = Math.abs(this._gap / this._cosAngle);
		}
	};
	hachure.prototype.getNextLine = function () {
		var line = [];
		if (Math.abs(this._sinAngle) < 0.0001) {
			//Special case 1: Vertical hachuring
			if (this._pos < this._right) {
				line = [this._pos, this._top, this._pos, this._bottom];
				this._pos += this._gap;
				return line;
			}
		}
		else if (Math.abs(this._sinAngle) > 0.9999) {
			//Special case 2: Horizontal hachuring
			if (this._pos < this._bottom) {
				line = [this._left, this._pos, this._right, this._pos];
				this._pos += this._gap;
				return line;
			}
		}
		else {
			var xLower = this._pos - this._deltaX / 2;
			var xUpper = this._pos + this._deltaX / 2;
			var yLower = this._bottom;
			var yUpper = this._top;

			if (this._pos < this._right + this._deltaX) {
				while (((xLower < this._left) && (xUpper < this._left)) ||
					((xLower > this._right) && (xUpper > this._right))) {
					this._pos += this._hGap;
					xLower = this._pos - this._deltaX / 2;
					xUpper = this._pos + this._deltaX / 2;

					if (this._pos > this._right + this._deltaX) {
						return null;
					}
				}

				var s = new seg(xLower, yLower, xUpper, yUpper);

				if (s._getIntersection(this._left, this._bottom, this._left, this._top)) {
					xLower = s._xi;
					yLower = s._yi;
				}
				if (s._getIntersection(this._right, this._bottom, this._right, this._top)) {
					xUpper = s._xi;
					yUpper = s._yi;
				}
				if (this._tanAngle > 0) {
					xLower = this._right - (xLower - this._left);
					xUpper = this._right - (xUpper - this._left);
				}
				line = [xLower, yLower, xUpper, yUpper];
				this._pos += this._hGap;
				return line;
			}
		}
	};
	hachure.prototype.getCircleLine = function () {
		var radius = (this._bottom - this._top) / 2;
		var cx = this._left + radius;
		var cy = this._top + radius;
		var line = [];
		if (Math.abs(this._sinAngle) < 0.0001) {
			//Special case 1: Vertical hachuring
			if (this._pos < this._right) {
				var y1 = cy + Math.sqrt(radius * radius - (this._pos - cx) * (this._pos - cx));
				var y2 = cy - Math.sqrt(radius * radius - (this._pos - cx) * (this._pos - cx));
				line = [this._pos, y1, this._pos, y2];
				this._pos += this._gap;
				return line;
			}
		}
		else if (Math.abs(this._sinAngle) > 0.9999) {
			//Special case 2: Horizontal hachuring
			if (this._pos < this._bottom) {
				var x1 = cx + Math.sqrt(radius * radius - (this._pos - cy) * (this._pos - cy));
				var x2 = cx - Math.sqrt(radius * radius - (this._pos - cy) * (this._pos - cy));
				line = [x1, this._pos, x2, this._pos];
				this._pos += this._gap;
				return line;
			}
		}
		else {
			var line = [];
			while (line.length !== 4) {
				var xLower = this._pos - this._deltaX / 2;
				var xUpper = this._pos + this._deltaX / 2;
				var yLower = this._bottom;
				var yUpper = this._top;

				if (this._pos < this._right + this._deltaX) {
					while (((xLower < this._left) && (xUpper < this._left)) ||
						((xLower > this._right) && (xUpper > this._right))) {
						this._pos += this._hGap;
						xLower = this._pos - this._deltaX / 2;
						xUpper = this._pos + this._deltaX / 2;

						if (this._pos > this._right + this._deltaX) {
							return null;
						}
					}

					var s = new seg(xLower, yLower, xUpper, yUpper);

					line = s._intersectCircle(cx, cy, radius);
					this._pos += this._hGap;
				}
			}
			return line;
		}
	};
	return hachure;
});