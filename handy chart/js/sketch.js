define(["./hachure"], function(hachure) {
	
	var handy = function(roughness, bowing, vis, d3, transition) {
		this._roughness = roughness;
		this._bowing = bowing;
		this._vis = vis;
		this._d3 = d3;
		this._transition = transition;
		this._numEllipseSteps = 40;	
	};

    /** Sets the general roughness of the sketch.
     *  0 is very precise, 1 is a typically neat sketchiness, 5 is very sketchy.
     *  Vaules are capped between 0 and 10.
     *  @param roughness The sketchiness of the rendering.
     */
	handy.prototype.setRoughness = function(roughness) {
		this._roughness = Math.max(0, Math.min(roughness, 10));
	};

	/** Sets the amount of 'bowing' of lines.
	 *  Values are capped between 0 and 10.
	 *  @param bowing The degree of bowing in the rendering if straight lines.
	 */
	handy.prototype.setBowing = function(bowing) {
		this._bowing = Math.max(0, Math.min(bowing, 10));
	};

	/** Draws a 2D line between the given coordinate pairs.
	 *  @param x1 x coordinate of the start of the line.
	 *  @param y1 y coordinate of the start of the line.
	 *  @param x2 x coordinate of the end of the line.
	 *  @param y2 y coordinate of the end of the line.
	 *  @param maxOffset Maximum random offset in pixel coordinates.
	 *  @param delay the delay time of the transition.
	 *  @param uuid the unique id of the primitive.
	 */
	handy.prototype.line = function(x1, y1, x2, y2, delay, uuid) {
		var maxOffset = 2;

		//Ensure random perturbation is no more than 10% of line length.
		var len = Math.sqrt((x1-x2)*(x1-x2) + (y1-y2)*(y1-y2));
		var offset = maxOffset;

		if(maxOffset*10 > len) {
			offset = len/10;
		}
		var halfOffset = offset/2;
		var divergePoint = 0.2 + Math.random()*0.2;

		var midDispX = this._bowing*maxOffset*(y2-y1)/200;
		var midDispY = this._bowing*maxOffset*(x1-x2)/200;

		midDispX = this._getOffset(-midDispX, midDispX);
		midDispY = this._getOffset(-midDispY, midDispY);

		var data1 = [], data2 = [];
		data1.push({x:x1+this._getOffset(-offset,offset),
				   y:y1+this._getOffset(-offset,offset)
				  });
		data1.push({x:x1+(x2-x1)*divergePoint+midDispX+this._getOffset(-offset,offset),
				   y:y1+(y2-y1)*divergePoint+midDispY+this._getOffset(-offset,offset)
				  });
		data1.push({x:x1+2*(x2-x1)*divergePoint+midDispX+this._getOffset(-offset,offset),
				   y:y1+2*(y2-y1)*divergePoint+midDispX+this._getOffset(-offset,offset)
				  });
		data1.push({x:x2+this._getOffset(-offset,offset),
				   y:y2+this._getOffset(-offset,offset)
				  });
        //draw again
        data2.push({x:x1+this._getOffset(-offset,offset),
				   y:y1+this._getOffset(-offset,offset)
				  });
        data2.push({x:x1+(x2-x1)*divergePoint+midDispX+this._getOffset(-offset,offset),
				   y:y1+(y2-y1)*divergePoint+midDispY+this._getOffset(-offset,offset)
				  });
        data2.push({x:x1+2*(x2-x1)*divergePoint+midDispX+this._getOffset(-offset,offset),
				   y:y1+2*(y2-y1)*divergePoint+midDispX+this._getOffset(-offset,offset)
				  });
		data2.push({x:x2+this._getOffset(-offset,offset),
				   y:y2+this._getOffset(-offset,offset)
				  });
		
		//Grant the unique id to every primitive.
		var primitiveId;
		if(!uuid) {
			primitiveId = this._createUUID();
		}
		else {
			primitiveId = uuid;
		} 
		//define the line and draw the line twice through Catmull-Rom spline.
		var that = this;
		var path1, path2;
		var line = this._d3.svg.line()
            .interpolate("cardinal")
            .tension(0)
            .x(function(d) { return d.x; })
            .y(function(d) { return d.y; });
       
    	path1 = that._vis.append("svg:path")
                             .attr("d", line(data1))
                             .attr("class", primitiveId);
        //draw again.
    	path2 = that._vis.append("svg:path")
		                     .attr("d", line(data2))
		                     .attr("class", primitiveId);                     

		if(this._transition) {
	    	var totalLength1 = path1.node().getTotalLength();
	    
	    	path1.attr("stroke-dasharray", totalLength1 + " " + totalLength1)
		         .attr("stroke-dashoffset", totalLength1)
		         .transition()
		         .delay(delay)
		         .duration(100)
		         .ease("linear")
		         .attr("stroke-dashoffset", 0);

			var totalLength2 = path2.node().getTotalLength();

	    	path2.attr("stroke-dasharray", totalLength2 + " " + totalLength2)
		         .attr("stroke-dashoffset", totalLength2)
		         .transition()
		         .delay(delay)
		         .duration(100)
		         .ease("linear")
		         .attr("stroke-dashoffset", 0);			
		}	    
	    return d3.selectAll("." + primitiveId);
	};

	/** Draw a rectangle using the given location and dimensions. By default the
	 *  x,y coordinates will be the top left of the rectangle.
	 *  @param x x coordinate of the rectangle position.
	 *  @param y y coordinate of the rectangle position.
	 *  @param w Width of the rectangle.
	 *  @param h Height of the rectangle.
	 */
	handy.prototype.rect = function(x, y, w, h) {
		var primitiveId = this._createUUID();
		var left = x;
		var top = y;
		var right = x+w;
		var bottom = y+h;
		this.line(left, top, right, top, 0, primitiveId);
		this.line(right, top, right, bottom, 100, primitiveId);
		this.line(right, bottom, left, bottom, 200, primitiveId);
		this.line(left, bottom, left, top, 300, primitiveId);
		/*
		topLine[0] = topLine[0].concat(rightLine[0]).concat(bottomLine[0]).concat(leftLine[0]);
		return topLine;
		*/

		//Fill the rectangle area with hachure lines.
		var sinAngle = Math.sin(Math.PI/4);
		var cosAngle = Math.cos(Math.PI/4);
		var tanAngle = Math.tan(Math.PI/4);
		var hachureIterator = new hachure(top,bottom,left,right,8.5,sinAngle,cosAngle,tanAngle);
		var lineCoords;
		var prevCoords = hachureIterator.getNextLine();
		if(prevCoords) {
			this.line(prevCoords[0],prevCoords[1],prevCoords[2],prevCoords[3], 0, primitiveId);
			lineCoords = hachureIterator.getNextLine();
			while(lineCoords) {
				this.line(prevCoords[2],prevCoords[3],lineCoords[0],lineCoords[1], 0, primitiveId);
				this.line(lineCoords[0],lineCoords[1],lineCoords[2],lineCoords[3], 0, primitiveId);
				prevCoords = lineCoords;
				lineCoords = hachureIterator.getNextLine();
			}
		}
		
		return d3.selectAll("." + primitiveId);

	};

	/** Draws an ellipse using the given location and dimensions. By default the
	 *  x,y coordinates will be centre of the ellipse.
	 *  @param x x coordinate of the ellipse's position.
	 *  @param y y coordinate of the ellipse's positon.
	 *  @param w Width of the ellipse.
	 *  @param h Height of the ellipse.
	 */
	handy.prototype.ellipse = function(x, y, w, h, uuid) {
		var cx = x;
		var cy = y;
		var rx = Math.abs(w/2);
		var ry = Math.abs(h/2);
		var ellipseInc = 2*Math.PI/this._numEllipseSteps;

		if((rx == 0) || (ry == 0)) {
			//Never draw circles of radius 0.
			return;
		}

		if((rx < this._roughness/4) || (ry < this._roughness/4)) {
			//Don't draw anything with a radius less than a quarter of the roughness value.
			return;
		}

		//Add small proportionate perturbation to dimensions of ellipse
		rx += this._getOffset(-rx*0.05, rx*0.05);
		ry += this._getOffset(-ry*0.05, ry*0.05);

		var primitiveId;
		if(uuid) {
			primitiveId = uuid;
		}
		else {
			primitiveId = this._createUUID(); 
		}
		this._buildEllipse(cx, cy, rx, ry, 1, ellipseInc * this._getOffset(0.1, this._getOffset(0.4, 1)), primitiveId);
		this._buildEllipse(cx, cy, rx, ry, 1.5, 0, primitiveId);

		return d3.selectAll("." + primitiveId);
	};

	/** Draw a circle using the given location and radius.
	 *  @param x x coordinate of the center of the circle.
	 *  @param y y coordinate of the center of the circle.
	 *  @param r the radius of the circle.
	 */
	handy.prototype.circle = function(x, y, r) {
		var primitiveId = this._createUUID();
		//Fill the circle area with hachure lines.
			
		var sinAngle = Math.sin(Math.PI/4);
		var cosAngle = Math.cos(Math.PI/4);
		var tanAngle = Math.tan(Math.PI/4);
		var top = y -r;
		var bottom = y + r;
		var left = x -r;
		var right = x + r;
		var hachureIterator = new hachure(top,bottom,left,right,8.5,sinAngle,cosAngle,tanAngle);
		var lineCoords;
		var prevCoords = hachureIterator.getCircleLine();	
		if(prevCoords) {
			this.line(prevCoords[0],prevCoords[1],prevCoords[2],prevCoords[3], 0, primitiveId);
			lineCoords = hachureIterator.getCircleLine();
			while(lineCoords) {
				this.line(prevCoords[2],prevCoords[3],lineCoords[0],lineCoords[1], 0, primitiveId);
				this.line(lineCoords[0],lineCoords[1],lineCoords[2],lineCoords[3], 0, primitiveId);
				prevCoords = lineCoords;
				lineCoords = hachureIterator.getCircleLine();
			}
		}
		
		return this.ellipse(x, y, 2*r, 2*r, primitiveId);
	};

	/** Draw a triangle through the three pairs of coordinates.
	 *  @param x1 x coordinate of the first triangle vertex.
	 *  @param y1 y coordinate of the first triangle vertex.
	 *  @param x2 x coordinate of the second triangle vertex.
	 *  @param y2 y coordinate of the second triangle vertex.
	 *  @param x3 x coordinate of the third triangle vertex.
	 *  @param y3 y coordinate of the third triangle vertex.
	 */
	handy.prototype.triangle = function(x1, y1, x2, y2, x3, y3) {
		//Bounding rectangle of the triangle.
		var left = Math.min(x1, Math.min(x2, x3));
		var right = Math.max(x1, Math.max(x2, x3));
		var top = Math.max(y1, Math.max(y2, y3));
		var bottom = Math.min(y1, Math.min(y2, y3));

		var primitiveId = this._createUUID();

		this.line(x1, y1, x2, y2, 0, primitiveId);
		this.line(x2, y2, x3, y3, 100, primitiveId);
		this.line(x3, y3, x1, y1, 200, primitiveId);

		return d3.selectAll("." + primitiveId);
	};

	/** Draw a sector using the given parameters.
	 *  @param x x coordinate of the center of the sector.
	 *  @param y y coordinate of the center of the sector.
	 *  @param r the radius of the sector.
	 *  @param startRadian the start radian of the sector.
	 *  @param endRadian the end radian of the sector.
	 */
	handy.prototype.sector = function(x, y, r, startDegree, endDegree) {
		//Convert the degree to radian.
		var startRadian = Math.PI*startDegree/180;
		var endRadian = Math.PI*endDegree/180;
		var sectorInc = 2*Math.PI/this._numEllipseSteps;
		var data = [];
		var offset = 1.0;
		var primitiveId = this._createUUID();

		for (var theta = startRadian; theta < endRadian; theta+=sectorInc) {
			data.push({
				x: this._getOffset(-offset, offset) + x + r*Math.cos(theta),
				y: this._getOffset(-offset, offset) + y - r*Math.sin(theta)
			});
		}

		data.push({
			x: this._getOffset(-offset,offset) + x + r*Math.cos(endRadian),
			y: this._getOffset(-offset,offset) + y - r*Math.sin(endRadian)
		});

		var data2 = [];
		for (var theta = startRadian; theta < endRadian; theta+=sectorInc) {
			data2.push({
				x: this._getOffset(-offset, offset) + x + r*Math.cos(theta),
				y: this._getOffset(-offset, offset) + y - r*Math.sin(theta)
			});
		}

		data2.push({
			x: this._getOffset(-offset,offset) + x + r*Math.cos(endRadian),
			y: this._getOffset(-offset,offset) + y - r*Math.sin(endRadian)
		});

		var line = this._d3.svg.line()
            .interpolate("cardinal")
            .tension(0)
            .x(function(d) { return d.x; })
            .y(function(d) { return d.y; });

	    var path = this._vis.append("svg:path")
	        		   		.attr("d", line(data))
	        		   		.attr("class", primitiveId);
	    var path2 = this._vis.append("svg:path")
    		   		.attr("d", line(data2))
    		   		.attr("class", primitiveId);

	    if(this._transition) {
	    	var totalLength = path.node().getTotalLength();

		    path.attr("stroke-dasharray", totalLength + " " + totalLength)
		    	.attr("stroke-dashoffset", totalLength)
		    	.transition()
		    	.duration(100)
		    	.ease("linear")
		    	.attr("stroke-dashoffset", 0);

		    var totalLength2 = path2.node().getTotalLength();

		    path2.attr("stroke-dasharray", totalLength2 + " " + totalLength2)
		    	 .attr("stroke-dashoffset", totalLength2)
		    	 .transition()
		    	 .duration(100)
		    	 .ease("linear")
		    	 .attr("stroke-dashoffset", 0);
	    }

	    var startArcPoint = data[0];
	    var endArcPoint = data[data.length-1];

	    this.line(x, y, startArcPoint.x, startArcPoint.y, 100, primitiveId);
		this.line(x, y, endArcPoint.x, endArcPoint.y, 200, primitiveId);

		//Fill the sector area with lines...
		/*
		var lineCoords;
		var prevCoords = [this._getOffset(-offset, offset) + x + r*Math.cos(startRadian),
			              this._getOffset(-offset, offset) + y - r*Math.sin(startRadian),
			              x,
			              y];
		for (var theta = startRadian+sectorInc; theta < endRadian; theta+=sectorInc) {
			this.line(prevCoords[0],prevCoords[1],x, y, 0, primitiveId);
			lineCoords = [this._getOffset(-offset, offset) + x + r*Math.cos(theta),
			              this._getOffset(-offset, offset) + y - r*Math.sin(theta),
			              x,
			              y];
			this.line(lineCoords[0],lineCoords[1],lineCoords[2],lineCoords[3],0,primitiveId);
			prevCoords = lineCoords;
		}
		*/
		
		return d3.selectAll("." + primitiveId);
	};

	/** Adds the curved vertices to bulid an ellipse.
	 *  @param cx x coordinate of the centre of the ellipse.
	 *  @param cy y coordinate of the centre of the ellipse.
	 *  @param rx Radius in the x direction of the ellipse.
	 *  @param ry Radius in the y direction of the ellipse.
	 *  @param uuid The unique id of the primitive.
	 */
	handy.prototype._buildEllipse = function( cx, cy, rx, ry, offset, overlap, uuid) {
		var radialOffset = this._getOffset(-0.5,0.5)-Math.PI/2;
		var ellipseInc = 2*Math.PI/this._numEllipseSteps;
		var data = [];
		/*
		data.push({
			x: this._getOffset(-offset,offset)+cx+0.95*rx*Math.cos(radialOffset-ellipseInc),
			y: this._getOffset(-offset,offset)+cy+0.95*ry*Math.sin(radialOffset-ellipseInc)
		});
		*/
		for (var theta=radialOffset; theta<2*Math.PI+radialOffset-0.01; theta+=ellipseInc) {
			data.push({
				x: this._getOffset(-offset,offset)+cx+rx*Math.cos(theta),
				y: this._getOffset(-offset,offset)+cy+ry*Math.sin(theta)
			});
        }
        /*
        data.push({
        	x: this._getOffset(-offset,offset)+cx+rx*Math.cos(radialOffset+2*Math.PI+overlap*0.5),
        	y: this._getOffset(-offset,offset)+cy+ry*Math.sin(radialOffset+2*Math.PI+overlap*0.5)
        });
        data.push({
        	x: this._getOffset(-offset,offset)+cx+0.98*rx*Math.cos(radialOffset+overlap),
        	y: this._getOffset(-offset,offset)+cy+0.98*ry*Math.sin(radialOffset+overlap)
        });
        data.push({
        	x: this._getOffset(-offset,offset)+cx+0.9*rx*Math.cos(radialOffset+overlap*0.5),
        	y: this._getOffset(-offset,offset)+cy+0.9*ry*Math.sin(radialOffset+overlap*0.5)
        });
		*/
		var line = this._d3.svg.line()
            .interpolate("cardinal")
            .tension(0)
            .x(function(d) { return d.x; })
            .y(function(d) { return d.y; });

	    var path = this._vis.append("svg:path")
	        		   		.attr("d", line(data))
	        		   		.attr("class", uuid);
	    if(this._transition) {
	    	var totalLength = path.node().getTotalLength();

		    path.attr("stroke-dasharray", totalLength + " " + totalLength)
		    	.attr("stroke-dashoffset", totalLength)
		    	.transition()
		    	.duration(200)
		    	.ease("linear")
		    	.attr("stroke-dashoffset", 0);
	    }
	    
	};

	/** Generates a random offset around the given range scaled by roughness.
	 *  @param minValue minimum value of the range.
	 *  @param maxValue maximum value of the range.
	 */
	handy.prototype._getOffset = function(minValue,maxValue) {
		return this._roughness*(minValue + Math.random()*(maxValue-minValue));
	};

	/** Generate a UUID for every handy primitive.
	*/
	handy.prototype._createUUID = function() {
		var UUID = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
					    var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
					    return v.toString(16);
						});
		//"p" is added to keep the uuid as a string.
		return "p" + UUID;
	};
	return handy;
});