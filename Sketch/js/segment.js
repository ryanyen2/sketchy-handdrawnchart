define([], function () {
	var segment = function (px1, py1, px2, py2) {
		this._px1 = px1;
		this._py1 = py1;
		this._px2 = px2;
		this._py2 = py2;
		this._xi = null;   //Point of intersection
		this._yi = null;   //Point of intersection
	};

	/** Return the a,b,c coefficient of the Cartesian equation of the segment.
	 *  即一般式方程： Ax + By + C = 0
	 */
	segment.prototype.getA = function () {
		return this._py2 - this._py1;
	};

	segment.prototype.getB = function () {
		return this._px1 - this._px2;
	};

	segment.prototype.getC = function () {
		return (this._px2 * this._py1 - this._px1 * this._py2);
	};

	/** Determines if and where the segments intersects.
	 *  @param x1,y1,x2,y2 points of another segment.
	 *  @return The intersection coordinates.
	 */
	segment.prototype._getIntersection = function (x1, y1, x2, y2) {
		//The two gradients and two intercepts.
		var intc1, intc2;
		var grad1 = Number.MAX_VALUE;
		var grad2 = Number.MAX_VALUE;
		var a = this.getA();
		var b = this.getB();
		var c = this.getC();
		var a2 = y2 - y1;
		var b2 = x1 - x2;
		var c2 = x2 * y1 - x1 * y2;

		//Find gradient and intercept of first line.
		if (Math.abs(b) > 0.00001) {
			grad1 = -a / b;
			intc1 = -c / b;
		}

		//Find gradient and intercept of second line.
		if (Math.abs(b2) > 0.00001) {
			grad2 = -a2 / b2;
			intc2 = -c2 / b2;
		}

		if (grad1 == Number.MAX_VALUE) {    //Line 1 vertical.
			if (grad2 == Number.MAX_VALUE) {    //2 parallel vertical lines.
				//two distinct parallel lines.
				if (-c / a != -c2 / a2) {
					return false;
				}

				//Segments overlap along same vertical line.
				if ((this._py1 >= Math.min(y1, y2)) && (this._py1 <= Math.max(y1, y2))) {
					this._xi = this._px1;
					this._yi = this._py1;
					return true;
				}
				else if ((this._py2 >= Math.min(y1, y2)) && (this._py2 <= Math.max(y1, y2))) {
					this._xi = this._px2;
					this._yi = this._py2;
					return true;
				}
				else
					return false;
			}

			//Line 1 vertical, line 2 not parallel to it.
			this._xi = this._px1;
			this._yi = grad2 * this._xi + intc2;
			if (this._yi < Math.min(this._py1, this._py2) || this._yi > Math.max(this._py1, this._py2)) {
				return false;
			}
			else {
				return true;
			}
		}

		//Line 2 vertical, line 1 is not parallel to it.
		if (grad2 == Number.MAX_VALUE) {
			this._xi = x1;
			this._yi = grad1 * this._xi + intc1;
			if (this._yi < Math.min(y1, y2) || this._yi > Math.max(y1, y2)) {
				return false;
			}
			else {
				return true;
			}
		}

		//Two lines are parallel but not vertical.
		if (grad1 == grad2) {
			if (intc1 != intc2) {
				return false;
			}

			//Segments overlap along same non-vertical line.
			if ((this._px1 >= Math.min(x1, x2)) && (this._px1 <= Math.max(x1, x2))) {
				this._xi = this._px1;
				this._yi = this._py1;
				return true;
			}
			else if ((this._px2 >= Math.min(x1, x2)) && (this._px2 <= Math.max(x1, x2))) {
				this._xi = this._px2;
				this._yi = this._py2;
				return true;
			}
			else
				return false;
		}

		//If we get this far, all special cases have been dealt with.
		this._xi = (intc2 - intc1) / (grad1 - grad2);
		this._yi = grad1 * this._xi + intc1;
		return true;
	};

	/** Determines if and where the segment intersects with the circle.
	 *  @param cx, cy, r parameters of the circle.
	 *  @return The intersection coordinates.
	 */
	segment.prototype._intersectCircle = function (cx, cy, r) {
		//二元二次方程 -> 一元二次。求根公式法
		var A = (this._px2 - this._px1) * (this._px2 - this._px1) + (this._py2 - this._py1) * (this._py2 - this._py1);
		var B = 2 * ((this._px2 - this._px1) * (this._px1 - cx) + (this._py2 - this._py1) * (this._py1 - cy));
		var C = cx * cx + cy * cy + this._px1 * this._px1 + this._py1 * this._py1 - 2 * (cx * this._px1 + cy * this._py1) - r * r;
		var delet = B * B - 4 * A * C;
		if (delet < 0) {
			return [];
		}
		else if (delet == 0) {
			var u = -B / 2 / A;
			var interX = this._px1 + u * (this._px2 - this._px1);
			var interY = this._py1 + u * (this._py2 - this._py1);
			return [interX, interY];
		}
		else {
			var u1 = (-B + Math.sqrt(delet)) / 2 / A;
			var interX1 = this._px1 + u1 * (this._px2 - this._px1);
			var interY1 = this._py1 + u1 * (this._py2 - this._py1);
			var u2 = (-B - Math.sqrt(delet)) / 2 / A;
			var interX2 = this._px1 + u2 * (this._px2 - this._px1);
			var interY2 = this._py1 + u2 * (this._py2 - this._py1);
			return [interX1, interY1, interX2, interY2];
		}
	};
	return segment;
});