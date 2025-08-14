/**
 * Vega-Lite to Sketchy Converter
 * A utility library to convert Vega-Lite charts to hand-drawn sketchy versions
 * Supports: bar charts, line charts, scatter plots, area charts
 */
define(["./sketch"], function (SketchyRenderer) {

    var VegaSketchyConverter = function () {
        this.defaultOptions = {
            roughness: 0.8,
            bowing: 0.8,
            margin: { top: 20, right: 20, bottom: 60, left: 60 },
            strokeWidth: 2,
            axisColor: "#333",
            fontSize: 12,
            titleFontSize: 14,
            // Chart element controls
            sketchyBars: true,
            sketchyLines: true,
            sketchyPoints: true,
            sketchyAreas: true,
            sketchyXAxis: true,
            sketchyYAxis: true,
            sketchyLabels: true,
            // Individual roughness controls
            barRoughness: 0.8,
            lineRoughness: 0.8,
            pointRoughness: 0.8,
            areaRoughness: 0.8,
            axisRoughness: 0.5,
            labelJitter: 1.0,
            // Performance settings
            maxDataPoints: 1000,
            samplingMethod: 'uniform', // 'uniform', 'random', 'none'
            pointSize: 3
        };

        // Supported chart types
        this.supportedTypes = ['bar', 'line', 'point', 'circle', 'area', 'text'];
    };

    /**
     * Convert a Vega-Lite chart specification to a sketchy version
     * @param {Object} vegaSpec - Vega-Lite specification
     * @param {string} containerId - ID of the container element
     * @param {Object} options - Optional configuration
     */
    VegaSketchyConverter.prototype.convert = function (vegaSpec, containerId, options) {
        var self = this;
        var opts = this._mergeOptions(options);

        // Validate chart type
        var markType = typeof vegaSpec.mark === 'string' ? vegaSpec.mark : vegaSpec.mark.type;
        if (this.supportedTypes.indexOf(markType) === -1) {
            console.warn('Chart type "' + markType + '" is not fully supported. Attempting basic conversion.');
        }

        return new Promise(function (resolve, reject) {
            try {
                var data = vegaSpec.data.values;
                var encoding = vegaSpec.encoding;

                // Handle large datasets
                if (data.length > opts.maxDataPoints && opts.samplingMethod !== 'none') {
                    data = self._sampleData(data, opts.maxDataPoints, opts.samplingMethod);
                    console.log('Dataset sampled from ' + vegaSpec.data.values.length + ' to ' + data.length + ' points');
                }

                // Create sketchy version
                var sketchyChart = self._createSketchyChart(
                    data,
                    encoding,
                    containerId,
                    opts,
                    vegaSpec.width || 400,
                    vegaSpec.height || 300,
                    markType
                );

                resolve(sketchyChart);
            } catch (error) {
                reject(error);
            }
        });
    };

    /**
     * Create a sketchy chart from extracted data
     */
    VegaSketchyConverter.prototype._createSketchyChart = function (data, encoding, containerId, options, chartWidth, chartHeight, markType) {
        var margin = options.margin;
        var width = chartWidth - margin.left - margin.right;
        var height = chartHeight - margin.top - margin.bottom;

        // Clear container
        d3.select('#' + containerId).selectAll("*").remove();

        // Create SVG
        var svg = d3.select('#' + containerId).append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        // Create scales based on encoding
        var scales = this._createScales(data, encoding, width, height);

        // Create multiple sketchy renderers for different elements
        var mainSketch = new SketchyRenderer(options.roughness, options.bowing, svg, d3);
        var barSketch = new SketchyRenderer(options.barRoughness, options.bowing, svg, d3);
        var lineSketch = new SketchyRenderer(options.lineRoughness, options.bowing, svg, d3);
        var pointSketch = new SketchyRenderer(options.pointRoughness, options.bowing, svg, d3);
        var areaSketch = new SketchyRenderer(options.areaRoughness, options.bowing, svg, d3);
        var axisSketch = new SketchyRenderer(options.axisRoughness, options.bowing, svg, d3);

        // Draw chart based on mark type
        this._drawChart(data, encoding, svg, scales, options, markType, {
            mainSketch: mainSketch,
            barSketch: barSketch,
            lineSketch: lineSketch,
            pointSketch: pointSketch,
            areaSketch: areaSketch
        });

        // Draw axes
        this._drawSketchyAxes(svg, axisSketch, scales.xScale, scales.yScale, width, height, data, encoding, options);

        return {
            svg: svg,
            sketches: {
                mainSketch: mainSketch,
                barSketch: barSketch,
                lineSketch: lineSketch,
                pointSketch: pointSketch,
                areaSketch: areaSketch,
                axisSketch: axisSketch
            },
            data: data,
            scales: scales,
            options: options,
            markType: markType
        };
    };

    /**
     * Create scales based on encoding and data
     */
    VegaSketchyConverter.prototype._createScales = function (data, encoding, width, height) {
        var xScale, yScale, colorScale, sizeScale;
        var xField = encoding.x ? encoding.x.field : null;
        var yField = encoding.y ? encoding.y.field : null;
        var colorField = encoding.color ? encoding.color.field : null;
        var sizeField = encoding.size ? encoding.size.field : null;

        // X Scale
        if (encoding.x) {
            if (encoding.x.type === "nominal" || encoding.x.type === "ordinal") {
                xScale = d3.scale.ordinal()
                    .domain(data.map(function (d) { return d[xField]; }))
                    .rangeRoundBands([0, width], 0.1);
            } else if (encoding.x.type === "quantitative") {
                var xDomain = encoding.x.scale && encoding.x.scale.domain ?
                    encoding.x.scale.domain :
                    d3.extent(data, function (d) { return d[xField]; });
                xScale = d3.scale.linear()
                    .domain(xDomain)
                    .range([0, width]);
            } else if (encoding.x.type === "temporal") {
                // Convert dates and filter out invalid ones
                var dates = data.map(function (d) { return new Date(d[xField]); })
                    .filter(function (d) { return !isNaN(d.getTime()); });

                if (dates.length > 0) {
                    xScale = d3.time.scale()
                        .domain(d3.extent(dates))
                        .range([0, width]);
                } else {
                    console.warn('No valid dates found for temporal scale');
                    xScale = d3.time.scale()
                        .domain([new Date(), new Date()])
                        .range([0, width]);
                }
            }
        }

        // Y Scale
        if (encoding.y) {
            if (encoding.y.type === "quantitative") {
                var yDomain = encoding.y.scale && encoding.y.scale.domain ?
                    encoding.y.scale.domain :
                    d3.extent(data, function (d) { return d[yField]; });
                yScale = d3.scale.linear()
                    .domain(yDomain)
                    .range([height, 0]);
            } else if (encoding.y.type === "nominal" || encoding.y.type === "ordinal") {
                yScale = d3.scale.ordinal()
                    .domain(data.map(function (d) { return d[yField]; }))
                    .rangeRoundBands([height, 0], 0.1);
            }
        }

        // Color Scale
        if (encoding.color && colorField) {
            if (encoding.color.type === "nominal") {
                var colorDomain = data.map(function (d) { return d[colorField]; })
                    .filter(function (value, index, self) { return self.indexOf(value) === index; });
                colorScale = d3.scale.category20()
                    .domain(colorDomain);
            } else if (encoding.color.type === "quantitative") {
                colorScale = d3.scale.linear()
                    .domain(d3.extent(data, function (d) { return d[colorField]; }))
                    .range(["#lightblue", "#darkblue"]);
            }
        }

        // Size Scale
        if (encoding.size && sizeField) {
            sizeScale = d3.scale.linear()
                .domain(d3.extent(data, function (d) { return d[sizeField]; }))
                .range([2, 20]);
        }

        return {
            xScale: xScale,
            yScale: yScale,
            colorScale: colorScale,
            sizeScale: sizeScale
        };
    };

    /**
     * Sample large datasets for performance
     */
    VegaSketchyConverter.prototype._sampleData = function (data, maxPoints, method) {
        if (data.length <= maxPoints) return data;

        if (method === 'uniform') {
            var step = Math.floor(data.length / maxPoints);
            return data.filter(function (d, i) { return i % step === 0; });
        } else if (method === 'random') {
            var shuffled = data.slice();
            for (var i = shuffled.length - 1; i > 0; i--) {
                var j = Math.floor(Math.random() * (i + 1));
                var temp = shuffled[i];
                shuffled[i] = shuffled[j];
                shuffled[j] = temp;
            }
            return shuffled.slice(0, maxPoints);
        }

        return data.slice(0, maxPoints);
    };

    /**
     * Draw chart based on mark type
     */
    VegaSketchyConverter.prototype._drawChart = function (data, encoding, svg, scales, options, markType, sketches) {
        switch (markType) {
            case 'bar':
                this._drawBars(data, encoding, svg, scales, options, sketches.barSketch);
                break;
            case 'line':
                this._drawLine(data, encoding, svg, scales, options, sketches.lineSketch);
                break;
            case 'point':
            case 'circle':
                this._drawPoints(data, encoding, svg, scales, options, sketches.pointSketch);
                break;
            case 'area':
                this._drawArea(data, encoding, svg, scales, options, sketches.areaSketch);
                break;
            case 'text':
                this._drawText(data, encoding, svg, scales, options);
                break;
            default:
                console.warn('Mark type ' + markType + ' not implemented, falling back to points');
                this._drawPoints(data, encoding, svg, scales, options, sketches.pointSketch);
        }
    };

    /**
     * Draw sketchy bars
     */
    VegaSketchyConverter.prototype._drawBars = function (data, encoding, svg, scales, options, sketch) {
        var xField = encoding.x.field;
        var yField = encoding.y.field;
        var colorField = encoding.color ? encoding.color.field : null;

        data.forEach(function (d, i) {
            var barX, barY, barWidth, barHeight;

            if (encoding.x.type === "nominal" || encoding.x.type === "ordinal") {
                barX = scales.xScale(d[xField]);
                barWidth = scales.xScale.rangeBand();
                barY = scales.yScale(d[yField]);
                barHeight = scales.yScale(0) - scales.yScale(d[yField]);
            } else {
                // Horizontal bars
                barX = scales.xScale(0);
                barWidth = scales.xScale(d[xField]) - scales.xScale(0);
                barY = scales.yScale(d[yField]);
                barHeight = scales.yScale.rangeBand();
            }

            var color = this._getColor(d, encoding, scales, options);

            if (options.sketchyBars) {
                var rectPrimitive = sketch.rect(barX, barY, barWidth, barHeight);
                rectPrimitive.attr("stroke", color)
                    .attr("stroke-width", options.strokeWidth)
                    .attr("fill", "none");
            } else {
                svg.append("rect")
                    .attr("x", barX)
                    .attr("y", barY)
                    .attr("width", barWidth)
                    .attr("height", barHeight)
                    .attr("stroke", color)
                    .attr("stroke-width", options.strokeWidth)
                    .attr("fill", "none");
            }
        }.bind(this));
    };

    /**
     * Draw sketchy line chart
     */
    VegaSketchyConverter.prototype._drawLine = function (data, encoding, svg, scales, options, sketch) {
        var xField = encoding.x.field;
        var yField = encoding.y.field;
        var color = this._getColor(data[0], encoding, scales, options);

        // Convert temporal data if needed
        if (encoding.x.type === 'temporal') {
            data = data.map(function (d) {
                var newD = Object.assign({}, d);
                newD[xField] = new Date(d[xField]);
                return newD;
            });
        }

        // Validate data points before drawing
        data = data.filter(function (d) {
            return d[xField] != null && d[yField] != null &&
                !isNaN(d[yField]) &&
                (encoding.x.type !== 'temporal' || !isNaN(d[xField].getTime()));
        });

        if (options.sketchyLines) {
            // Draw sketchy line by connecting points
            for (var i = 0; i < data.length - 1; i++) {
                var x1 = scales.xScale(data[i][xField]);
                var y1 = scales.yScale(data[i][yField]);
                var x2 = scales.xScale(data[i + 1][xField]);
                var y2 = scales.yScale(data[i + 1][yField]);

                // Check for valid coordinates before drawing
                if (!isNaN(x1) && !isNaN(y1) && !isNaN(x2) && !isNaN(y2)) {
                    sketch.line(x1, y1, x2, y2)
                        .attr("stroke", color)
                        .attr("stroke-width", options.strokeWidth);
                }
            }
        } else {
            // Regular line
            var line = d3.svg.line()
                .x(function (d) { return scales.xScale(d[xField]); })
                .y(function (d) { return scales.yScale(d[yField]); });

            svg.append("path")
                .datum(data)
                .attr("d", line)
                .attr("stroke", color)
                .attr("stroke-width", options.strokeWidth)
                .attr("fill", "none");
        }
    };

    /**
     * Draw sketchy points/scatter plot - simplified approach like bubble.html
     */
    VegaSketchyConverter.prototype._drawPoints = function (data, encoding, svg, scales, options, sketch) {
        var xField = encoding.x.field;
        var yField = encoding.y.field;
        var sizeField = encoding.size ? encoding.size.field : null;
        var self = this;


        // Simple synchronous loop like in bubble.html
        for (var i = 10; i < 14; i++) {
            try {

                var d = data[i];
                var x = scales.xScale(d[xField]);
                var y = scales.yScale(d[yField]);
                var size = sizeField && scales.sizeScale ? scales.sizeScale(d[sizeField]) : options.pointSize;
                var color = self._getColor(d, encoding, scales, options);
                // var color = d3.scale.category20c();
                console.log('Drawing point at:', x, y, 'with size:', size, 'and color:', color);

                // Validate coordinates before drawing
                if (isNaN(x) || isNaN(y) || isNaN(size)) {
                    continue; // Skip invalid points
                }

                var circlePrimitive = sketch.circle(x, y, size);
                // var circleColor = color(d[colorField] || encoding.color.value || options.axisColor);
                circlePrimitive.attr("stroke", color);
            } catch (error) {
                console.error('Error drawing point:', error);
                // Handle error gracefully, skip this point
                continue; // Skip this point
            }


            // if (options.sketchyPoints) {
            //     var circlePrimitive = sketch.circle(x, y, size);
            //     if (circlePrimitive) {
            //         circlePrimitive.attr("stroke", color)
            //                       .attr("stroke-width", options.strokeWidth)
            //                       .attr("fill", "none");
            //     }
            // } else {
            //     svg.append("circle")
            //        .attr("cx", x)
            //        .attr("cy", y)
            //        .attr("r", size)
            //        .attr("stroke", color)
            //        .attr("stroke-width", options.strokeWidth)
            //        .attr("fill", "none");
            // }
        }
    };

    /**
     * Draw sketchy area chart
     */
    VegaSketchyConverter.prototype._drawArea = function (data, encoding, svg, scales, options, sketch) {
        var xField = encoding.x.field;
        var yField = encoding.y.field;
        var color = this._getColor(data[0], encoding, scales, options);

        // Convert temporal data if needed and validate
        if (encoding.x.type === 'temporal') {
            data = data.map(function (d) {
                var newD = Object.assign({}, d);
                newD[xField] = new Date(d[xField]);
                return newD;
            });
        }

        // Filter out invalid data points
        data = data.filter(function (d) {
            var x = scales.xScale(d[xField]);
            var y = scales.yScale(d[yField]);
            return !isNaN(x) && !isNaN(y) &&
                d[xField] != null && d[yField] != null &&
                (encoding.x.type !== 'temporal' || !isNaN(d[xField].getTime()));
        });

        if (data.length === 0) {
            console.warn('No valid data points for area chart');
            return;
        }

        if (options.sketchyAreas) {
            // Draw area as filled polygon using sketchy lines
            var points = [];

            // Top line
            for (var i = 0; i < data.length; i++) {
                var x = scales.xScale(data[i][xField]);
                var y = scales.yScale(data[i][yField]);
                if (!isNaN(x) && !isNaN(y)) {
                    points.push({ x: x, y: y });
                }
            }

            // Bottom line (baseline)
            for (var i = data.length - 1; i >= 0; i--) {
                var x = scales.xScale(data[i][xField]);
                var y = scales.yScale(0);
                if (!isNaN(x) && !isNaN(y)) {
                    points.push({ x: x, y: y });
                }
            }

            // Draw polygon edges with validation
            for (var i = 0; i < points.length; i++) {
                var next = (i + 1) % points.length;
                if (points[i] && points[next] &&
                    !isNaN(points[i].x) && !isNaN(points[i].y) &&
                    !isNaN(points[next].x) && !isNaN(points[next].y)) {
                    sketch.line(points[i].x, points[i].y, points[next].x, points[next].y)
                        .attr("stroke", color)
                        .attr("stroke-width", options.strokeWidth);
                }
            }
        } else {
            var area = d3.svg.area()
                .x(function (d) { return scales.xScale(d[xField]); })
                .y0(scales.yScale(0))
                .y1(function (d) { return scales.yScale(d[yField]); });

            svg.append("path")
                .datum(data)
                .attr("d", area)
                .attr("stroke", color)
                .attr("stroke-width", options.strokeWidth)
                .attr("fill", "none");
        }
    };

    /**
     * Draw text marks
     */
    VegaSketchyConverter.prototype._drawText = function (data, encoding, svg, scales, options) {
        var xField = encoding.x.field;
        var yField = encoding.y.field;
        var textField = encoding.text ? encoding.text.field : yField;

        data.forEach(function (d) {
            var x = scales.xScale(d[xField]) + (options.sketchyLabels ? (Math.random() - 0.5) * options.labelJitter : 0);
            var y = scales.yScale(d[yField]) + (options.sketchyLabels ? (Math.random() - 0.5) * options.labelJitter : 0);
            var color = this._getColor(d, encoding, scales, options);

            svg.append("text")
                .attr("x", x)
                .attr("y", y)
                .attr("text-anchor", "middle")
                .style("font-family", "xkcd, sans-serif")
                .style("font-size", options.fontSize + "px")
                .style("fill", color)
                .text(d[textField]);
        }.bind(this));
    };

    /**
     * Get color for a data point
     */
    VegaSketchyConverter.prototype._getColor = function (dataPoint, encoding, scales, options) {
        if (encoding.color && encoding.color.field && scales.colorScale) {
            return scales.colorScale(dataPoint[encoding.color.field]);
        } else if (encoding.color && encoding.color.value) {
            return encoding.color.value;
        } else if (encoding.mark && encoding.mark.color) {
            return encoding.mark.color;
        }
        return options.axisColor;
    };

    /**
     * Draw sketchy bars (legacy method for backward compatibility)
     */
    VegaSketchyConverter.prototype._drawSketchyBars = function (data, sketch, svg, xScale, yScale, xField, yField, height, options, encoding) {
        data.forEach(function (d, i) {
            var barX = xScale(d[xField]);
            var barY = yScale(d[yField]);
            var barWidth = xScale.rangeBand();
            var barHeight = height - yScale(d[yField]);

            // Apply color if specified
            var color = options.axisColor;
            if (encoding.color && d[encoding.color.field]) {
                color = d[encoding.color.field];
            } else if (encoding.mark && encoding.mark.color) {
                color = encoding.mark.color;
            }

            if (options.sketchyBars) {
                var rectPrimitive = sketch.rect(barX, barY, barWidth, barHeight);
                rectPrimitive.attr("stroke", color)
                    .attr("stroke-width", options.strokeWidth)
                    .attr("fill", "none");
            } else {
                // Create regular rectangle
                svg.append("rect")
                    .attr("x", barX)
                    .attr("y", barY)
                    .attr("width", barWidth)
                    .attr("height", barHeight)
                    .attr("stroke", color)
                    .attr("stroke-width", options.strokeWidth)
                    .attr("fill", "none");
            }
        });
    };

    /**
     * Draw sketchy axes (updated for multiple chart types)
     */
    VegaSketchyConverter.prototype._drawSketchyAxes = function (svg, sketch, xScale, yScale, width, height, data, encoding, options) {
        if (!xScale || !yScale) return;

        var xField = encoding.x ? encoding.x.field : null;
        var yField = encoding.y ? encoding.y.field : null;

        // Y-axis
        if (options.sketchyYAxis) {
            sketch.line(0, 0, 0, height)
                .attr("stroke", options.axisColor)
                .attr("stroke-width", options.strokeWidth);
        } else {
            svg.append("line")
                .attr("x1", 0).attr("y1", 0)
                .attr("x2", 0).attr("y2", height)
                .attr("stroke", options.axisColor)
                .attr("stroke-width", options.strokeWidth);
        }

        // X-axis
        if (options.sketchyXAxis) {
            sketch.line(0, height, width, height)
                .attr("stroke", options.axisColor)
                .attr("stroke-width", options.strokeWidth);
        } else {
            svg.append("line")
                .attr("x1", 0).attr("y1", height)
                .attr("x2", width).attr("y2", height)
                .attr("stroke", options.axisColor)
                .attr("stroke-width", options.strokeWidth);
        }

        // Y-axis ticks and labels
        if (yScale.ticks) {
            var yTicks = yScale.ticks(5);
            yTicks.forEach(function (tick) {
                var y = yScale(tick);

                if (options.sketchyYAxis) {
                    sketch.line(-5, y, 0, y)
                        .attr("stroke", options.axisColor)
                        .attr("stroke-width", 1);
                } else {
                    svg.append("line")
                        .attr("x1", -5).attr("y1", y)
                        .attr("x2", 0).attr("y2", y)
                        .attr("stroke", options.axisColor)
                        .attr("stroke-width", 1);
                }

                var labelX = -10 + (options.sketchyLabels ? (Math.random() - 0.5) * options.labelJitter : 0);
                var labelY = y + 4 + (options.sketchyLabels ? (Math.random() - 0.5) * options.labelJitter : 0);

                svg.append("text")
                    .attr("x", labelX)
                    .attr("y", labelY)
                    .attr("text-anchor", "end")
                    .style("font-family", "xkcd, sans-serif")
                    .style("font-size", options.fontSize + "px")
                    .style("fill", options.axisColor)
                    .text(this._formatTick(tick, encoding.y));
            }.bind(this));
        }

        // X-axis ticks and labels
        if (xScale.ticks && encoding.x.type === "quantitative") {
            var xTicks = xScale.ticks(5);
            xTicks.forEach(function (tick) {
                var x = xScale(tick);

                if (options.sketchyXAxis) {
                    sketch.line(x, height, x, height + 5)
                        .attr("stroke", options.axisColor)
                        .attr("stroke-width", 1);
                } else {
                    svg.append("line")
                        .attr("x1", x).attr("y1", height)
                        .attr("x2", x).attr("y2", height + 5)
                        .attr("stroke", options.axisColor)
                        .attr("stroke-width", 1);
                }

                var labelX = x + (options.sketchyLabels ? (Math.random() - 0.5) * options.labelJitter : 0);
                var labelY = height + 20 + (options.sketchyLabels ? (Math.random() - 0.5) * options.labelJitter : 0);

                svg.append("text")
                    .attr("x", labelX)
                    .attr("y", labelY)
                    .attr("text-anchor", "middle")
                    .style("font-family", "xkcd, sans-serif")
                    .style("font-size", options.fontSize + "px")
                    .style("fill", options.axisColor)
                    .text(this._formatTick(tick, encoding.x));
            }.bind(this));
        } else if (xScale.domain && (encoding.x.type === "nominal" || encoding.x.type === "ordinal")) {
            // Categorical X-axis
            xScale.domain().forEach(function (category) {
                var x = xScale(category) + (xScale.rangeBand ? xScale.rangeBand() / 2 : 0);

                if (options.sketchyXAxis) {
                    sketch.line(x, height, x, height + 5)
                        .attr("stroke", options.axisColor)
                        .attr("stroke-width", 1);
                } else {
                    svg.append("line")
                        .attr("x1", x).attr("y1", height)
                        .attr("x2", x).attr("y2", height + 5)
                        .attr("stroke", options.axisColor)
                        .attr("stroke-width", 1);
                }

                var labelX = x + (options.sketchyLabels ? (Math.random() - 0.5) * options.labelJitter : 0);
                var labelY = height + 20 + (options.sketchyLabels ? (Math.random() - 0.5) * options.labelJitter : 0);

                svg.append("text")
                    .attr("x", labelX)
                    .attr("y", labelY)
                    .attr("text-anchor", "middle")
                    .style("font-family", "xkcd, sans-serif")
                    .style("font-size", options.fontSize + "px")
                    .style("fill", options.axisColor)
                    .text(category);
            });
        }

        // Axis titles with optional jitter
        if (encoding.x && encoding.x.axis && encoding.x.axis.title) {
            var xTitleX = width / 2 + (options.sketchyLabels ? (Math.random() - 0.5) * options.labelJitter * 2 : 0);
            var xTitleY = height + 45 + (options.sketchyLabels ? (Math.random() - 0.5) * options.labelJitter : 0);

            svg.append("text")
                .attr("x", xTitleX)
                .attr("y", xTitleY)
                .attr("text-anchor", "middle")
                .style("font-family", "xkcd, sans-serif")
                .style("font-size", options.titleFontSize + "px")
                .style("fill", options.axisColor)
                .text(encoding.x.axis.title);
        }

        if (encoding.y && encoding.y.axis && encoding.y.axis.title) {
            var yTitleX = -height / 2 + (options.sketchyLabels ? (Math.random() - 0.5) * options.labelJitter * 2 : 0);
            var yTitleY = -40 + (options.sketchyLabels ? (Math.random() - 0.5) * options.labelJitter : 0);

            svg.append("text")
                .attr("transform", "rotate(-90)")
                .attr("x", yTitleX)
                .attr("y", yTitleY)
                .attr("text-anchor", "middle")
                .style("font-family", "xkcd, sans-serif")
                .style("font-size", options.titleFontSize + "px")
                .style("fill", options.axisColor)
                .text(encoding.y.axis.title);
        }
    };

    /**
     * Format tick labels based on encoding
     */
    VegaSketchyConverter.prototype._formatTick = function (value, encoding) {
        if (!encoding) return value.toString();

        if (encoding.axis && encoding.axis.format) {
            if (encoding.axis.format === ".0%") {
                return (value * 100).toFixed(0) + "%";
            } else if (encoding.axis.format === ".1f") {
                return value.toFixed(1);
            } else if (encoding.axis.format === ".2f") {
                return value.toFixed(2);
            }
            // Add more format handlers as needed
        }

        // Auto-format large numbers
        if (typeof value === 'number') {
            if (Math.abs(value) >= 1000000) {
                return (value / 1000000).toFixed(1) + "M";
            } else if (Math.abs(value) >= 1000) {
                return (value / 1000).toFixed(1) + "K";
            }
        }

        return value.toString();
    };

    /**
     * Merge user options with defaults
     */
    VegaSketchyConverter.prototype._mergeOptions = function (userOptions) {
        var options = {};
        for (var key in this.defaultOptions) {
            options[key] = this.defaultOptions[key];
        }
        if (userOptions) {
            for (var key in userOptions) {
                if (key === 'margin' && typeof userOptions[key] === 'object') {
                    options[key] = {};
                    for (var marginKey in this.defaultOptions.margin) {
                        options[key][marginKey] = this.defaultOptions.margin[marginKey];
                    }
                    for (var marginKey in userOptions[key]) {
                        options[key][marginKey] = userOptions[key][marginKey];
                    }
                } else {
                    options[key] = userOptions[key];
                }
            }
        }
        return options;
    };

    /**
     * Update chart with new roughness/bowing parameters
     */
    VegaSketchyConverter.prototype.updateSketchiness = function (chart, roughness, bowing) {
        chart.options.roughness = roughness;
        chart.options.bowing = bowing;

        // Recreate the chart with new parameters
        return this._createSketchyChart(
            chart.data,
            { x: { field: 'x' }, y: { field: 'y' } }, // Simplified for update
            chart.svg.node().parentNode.id,
            chart.options,
            400, 300
        );
    };

    return VegaSketchyConverter;
});
