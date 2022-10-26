/* eslint-disable */

var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _AxesMgmt_x, _AxesMgmt_y, _AxesMgmt_xConfig, _AxesMgmt_yConfig;
/* TODO (excerpt)
 *   - option to define whether to draw axes at the beginning (before other actions) or at the end
        ~~ alternatively, respect original order => likely more difficult to implement
 *   - adapt ticks label font size to string length; maybe even rotate y-label if it becomes too long
 */
export var LabelPosition;
(function (LabelPosition) {
    LabelPosition["TOP_CENTER"] = "top-center";
    LabelPosition["TOP_RIGHT"] = "top-right";
    LabelPosition["TOP_LEFT"] = "top-left";
    LabelPosition["BOTTOM_CENTER"] = "bottom-center";
    LabelPosition["BOTTOM_RIGHT"] = "bottom-right";
    LabelPosition["BOTTOM_LEFT"] = "bottom-left";
    LabelPosition["LEFT"] = "left";
    LabelPosition["RIGHT"] = "right";
})(LabelPosition || (LabelPosition = {}));
;
class AxesMgmt {
    constructor(_config) {
        _AxesMgmt_x.set(this, void 0);
        _AxesMgmt_y.set(this, void 0);
        _AxesMgmt_xConfig.set(this, void 0);
        _AxesMgmt_yConfig.set(this, void 0);
        __classPrivateFieldSet(this, _AxesMgmt_x, (_config === null || _config === void 0 ? void 0 : _config.x) !== false, "f");
        __classPrivateFieldSet(this, _AxesMgmt_y, (_config === null || _config === void 0 ? void 0 : _config.y) !== false, "f");
        const merge = (config, defaultConfig, xOrY) => {
            var _a, _b, _c, _d, _e;
            const hasStartArrow = typeof config === "object" && ((_b = (_a = config.lineConfig) === null || _a === void 0 ? void 0 : _a.arrows) === null || _b === void 0 ? void 0 : _b.start) && !((_d = (_c = config.lineConfig) === null || _c === void 0 ? void 0 : _c.arrows) === null || _d === void 0 ? void 0 : _d.end);
            const result = AxesMgmt._merge(typeof config === "object" ? config : undefined, defaultConfig);
            if ((_e = result.lineConfig.label) === null || _e === void 0 ? void 0 : _e.text)
                AxesMgmt._merge(result.lineConfig.label, xOrY ? AxesMgmt._DEFAULT_LABEL_CONFIG_X : AxesMgmt._DEFAULT_LABEL_CONFIG_Y);
            if (hasStartArrow)
                delete result.lineConfig.arrows.end;
            return result;
        };
        __classPrivateFieldSet(this, _AxesMgmt_xConfig, __classPrivateFieldGet(this, _AxesMgmt_x, "f") ? merge(_config === null || _config === void 0 ? void 0 : _config.x, AxesMgmt._DEFAULT_AXIS, true) : AxesMgmt._DEFAULT_AXIS, "f");
        __classPrivateFieldSet(this, _AxesMgmt_yConfig, __classPrivateFieldGet(this, _AxesMgmt_y, "f") ? merge(_config === null || _config === void 0 ? void 0 : _config.y, AxesMgmt._DEFAULT_AXIS, false) : AxesMgmt._DEFAULT_AXIS, "f");
        const setLabelAndTicksFonts = (config, derivedSettings) => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j;
            let labelFont = _config.font, ticksFont = _config.font;
            let labelStyle = _config.style, axisStyle = _config.style, ticksStyle = _config.style;
            let grid = _config.grid || false;
            let keepOffset = _config.keepOffsetContent;
            if (typeof config === "object") {
                labelFont = ((_b = (_a = config.lineConfig) === null || _a === void 0 ? void 0 : _a.label) === null || _b === void 0 ? void 0 : _b.font) || config.font || labelFont;
                ticksFont = ((_c = config.ticks) === null || _c === void 0 ? void 0 : _c.font) || config.font || ticksFont;
                axisStyle = ((_d = config.lineConfig) === null || _d === void 0 ? void 0 : _d.style) || config.style || axisStyle;
                labelStyle = ((_f = (_e = config.lineConfig) === null || _e === void 0 ? void 0 : _e.label) === null || _f === void 0 ? void 0 : _f.style) || axisStyle;
                ticksStyle = ((_g = config.ticks) === null || _g === void 0 ? void 0 : _g.style) || config.style || ticksStyle;
                grid = ((_h = config.ticks) === null || _h === void 0 ? void 0 : _h.grid) !== undefined ? config.ticks.grid : grid;
                keepOffset = config.keepOffsetContent !== undefined ? config.keepOffsetContent : keepOffset;
            }
            if (axisStyle)
                derivedSettings.lineConfig.style = axisStyle;
            if ((_j = derivedSettings.lineConfig) === null || _j === void 0 ? void 0 : _j.label) {
                if (labelFont)
                    derivedSettings.lineConfig.label.font = labelFont;
                if (labelStyle)
                    derivedSettings.lineConfig.label.style = labelStyle;
            }
            if (derivedSettings.ticks) {
                if (ticksFont)
                    derivedSettings.ticks.font = ticksFont;
                if (ticksStyle)
                    derivedSettings.ticks.style = ticksStyle;
                if (grid)
                    derivedSettings.ticks.grid = grid;
            }
            if (keepOffset !== undefined)
                derivedSettings.keepOffsetContent = keepOffset;
        };
        if (__classPrivateFieldGet(this, _AxesMgmt_x, "f"))
            setLabelAndTicksFonts(_config === null || _config === void 0 ? void 0 : _config.x, __classPrivateFieldGet(this, _AxesMgmt_xConfig, "f"));
        if (__classPrivateFieldGet(this, _AxesMgmt_y, "f"))
            setLabelAndTicksFonts(_config === null || _config === void 0 ? void 0 : _config.y, __classPrivateFieldGet(this, _AxesMgmt_yConfig, "f"));
    }
    draw(state, width, height) {
        var _a, _b, _c, _d;
        const ctx = state.context;
        // FIXME use ctx.translate for xOffset, yOffset? Optional? => if drawn before other stuff this could even be helpful for positioning other elements
        let xOffset = __classPrivateFieldGet(this, _AxesMgmt_yConfig, "f").offsetBoundary;
        if (xOffset < 0)
            xOffset = Math.min(Math.round(width / 10), 50);
        let yOffset = __classPrivateFieldGet(this, _AxesMgmt_xConfig, "f").offsetBoundary;
        if (yOffset < 0)
            yOffset = Math.min(Math.round(height / 10), 50);
        if (__classPrivateFieldGet(this, _AxesMgmt_x, "f")) {
            const c = __classPrivateFieldGet(this, _AxesMgmt_xConfig, "f");
            if (!c.keepOffsetContent) {
                // draw a white rectangle
                ctx.fillStyle = "white";
                ctx.fillRect(0, height - yOffset, width, height);
            }
            // @ts-ignore
            LineUtils._drawLine(ctx, c.offsetDrawn ? 0 : xOffset, height - yOffset, width, height - yOffset, c.lineConfig);
            // @ts-ignore
            if (c.ticks && (c.ticks.values || c.ticks.valueRange)) {
                const config = c.ticks;
                const tickEndX = ((_b = (_a = c.lineConfig) === null || _a === void 0 ? void 0 : _a.arrows) === null || _b === void 0 ? void 0 : _b.end) ? width - xOffset : width;
                const ticks = AxesMgmt._getTickPositions(xOffset, height - yOffset, tickEndX, height - yOffset, config, state.newTransformation);
                for (const tick of ticks) {
                    const lineConfig = {};
                    if (tick.label) {
                        lineConfig.label = {
                            text: tick.label,
                            position: LabelPosition.LEFT
                        };
                        if (config.font)
                            lineConfig.label.font = config.font;
                        if (config.style) {
                            lineConfig.label.style = config.style;
                            lineConfig.style = config.style;
                        }
                    }
                    // @ts-ignore
                    LineUtils._drawLine(ctx, tick.x, tick.y + config.length, tick.x, tick.y, lineConfig);
                    if (config.grid) {
                        // @ts-ignore
                        LineUtils._drawLine(ctx, tick.x, tick.y, tick.x, 0, AxesMgmt._GRID_CONFIG);
                    }
                }
            }
        }
        if (__classPrivateFieldGet(this, _AxesMgmt_y, "f")) {
            const c = __classPrivateFieldGet(this, _AxesMgmt_yConfig, "f");
            if (!c.keepOffsetContent) {
                // draw a white rectangle
                ctx.fillStyle = "white";
                ctx.fillRect(0, 0, xOffset, height);
            }
            // @ts-ignore
            LineUtils._drawLine(ctx, xOffset, c.offsetDrawn ? height : height - yOffset, xOffset, 0, c.lineConfig);
            // @ts-ignore
            if (c.ticks && (c.ticks.values || c.ticks.valueRange)) {
                const config = c.ticks;
                const tickEndY = ((_d = (_c = c.lineConfig) === null || _c === void 0 ? void 0 : _c.arrows) === null || _d === void 0 ? void 0 : _d.end) ? yOffset : 0;
                const ticks = AxesMgmt._getTickPositions(xOffset, height - yOffset, xOffset, tickEndY, config, state.newTransformation);
                for (const tick of ticks) {
                    const lineConfig = {};
                    if (tick.label) {
                        lineConfig.label = {
                            text: tick.label,
                            position: LabelPosition.LEFT
                        };
                        if (config.font)
                            lineConfig.label.font = config.font;
                        if (config.style) {
                            lineConfig.label.style = config.style;
                            lineConfig.style = config.style;
                        }
                    }
                    // @ts-ignore
                    LineUtils._drawLine(ctx, tick.x - config.length, tick.y, tick.x, tick.y, lineConfig);
                    if (config.grid) {
                        // @ts-ignore
                        LineUtils._drawLine(ctx, tick.x, tick.y, width, tick.y, AxesMgmt._GRID_CONFIG);
                    }
                }
            }
        }
    }
    static _getTicks(valueRange, numTicks) {
        const reverse = valueRange[0] > valueRange[1];
        if (reverse)
            valueRange = [valueRange[1], valueRange[0]];
        const length = Math.abs(valueRange[1] - valueRange[0]);
        const l = length / (numTicks - 1);
        const tenBase = Math.round(Math.log(l) / AxesMgmt._LOG_10); // log with base 10 of l
        let proposedDistance = Math.pow(10, tenBase);
        if (Math.floor(length / proposedDistance) < Math.max(numTicks - 2, 3))
            proposedDistance = proposedDistance / 2;
        else if (Math.ceil(length / proposedDistance) > numTicks + 2)
            proposedDistance = proposedDistance * 2;
        const startFactor = Math.floor((valueRange[0] + Number.EPSILON) / proposedDistance);
        let start = startFactor * proposedDistance;
        while (start < valueRange[0]) {
            start += proposedDistance;
        }
        const ticks = [];
        while (start < valueRange[1]) {
            ticks.push(start);
            start += proposedDistance;
        }
        const decimals = proposedDistance >= 1 ? 0 : -Math.floor(Math.log(proposedDistance) / AxesMgmt._LOG_10);
        if (reverse)
            ticks.reverse();
        return [ticks, decimals];
    }
    // coordinates: line ticks will be attached to
    static _getTickPositions(xStart, yStart, xEnd, yEnd, config, currentTransform) {
        var _a;
        // @ts-ignore
        const num = Math.round(((_a = config.values) === null || _a === void 0 ? void 0 : _a.length) || config.numberTicks);
        const x = xEnd - xStart;
        const y = yEnd - yStart;
        const lengthSquared = x * x + y * y;
        if (!(lengthSquared > 0) || !(num > 1))
            return [];
        if (!config.valueRange) { // in this case we keep the tick positions fixed FIXME move static positions as well?
            const fracX = x / (num - 1);
            const fracY = y / (num - 1);
            const ticks = [];
            for (let idx = 0; idx < num; idx++) {
                const tick = {
                    x: xStart + idx * fracX,
                    y: yStart + idx * fracY,
                };
                if (config.values)
                    tick.label = config.values[idx];
                ticks.push(tick);
            }
            return ticks;
        }
        let valueRange = config.valueRange;
        if (!currentTransform.isIdentity) {
            const inverse = currentTransform.inverse();
            const originalStart = inverse.transformPoint({ x: xStart, y: yStart });
            const originalEnd = inverse.transformPoint({ x: xEnd, y: yEnd });
            // project new point to axis vector and determine the distance from the the start
            const delta = (p) => { return { x: p.x - xStart, y: p.y - yStart }; };
            const getValue = (p) => (p.y * y + p.x * x) / lengthSquared * (valueRange[1] - valueRange[0]) + valueRange[0];
            valueRange = [getValue(delta(originalStart)), getValue(delta(originalEnd))];
        }
        const [ticks, decimals] = AxesMgmt._getTicks(valueRange, config.numberTicks);
        return ticks.map(tick0 => {
            const fraction = (tick0 - valueRange[0]) / (valueRange[1] - valueRange[0]);
            const tick = {
                x: xStart + fraction * x,
                y: yStart + fraction * y,
                label: tick0.toFixed(decimals)
            };
            return tick;
        });
    }
    // mutating deep merge of defaultObj into obj
    static _merge(obj, defaultObj) {
        if (!obj)
            return AxesMgmt._merge(Array.isArray(defaultObj) ? [] : {}, defaultObj);
        Object.keys(defaultObj).forEach((key) => {
            const value = obj[key];
            const defaultValue = defaultObj[key];
            if (value === undefined || value === null || (value === true && typeof defaultValue === "object")) {
                if (defaultValue !== null && typeof defaultValue === "object")
                    obj[key] = AxesMgmt._merge(Array.isArray(defaultValue) ? [] : {}, defaultValue);
                else
                    obj[key] = defaultValue;
            }
            else if (typeof value === "object")
                AxesMgmt._merge(value, defaultValue);
        });
        return obj;
    }
}
_AxesMgmt_x = new WeakMap(), _AxesMgmt_y = new WeakMap(), _AxesMgmt_xConfig = new WeakMap(), _AxesMgmt_yConfig = new WeakMap();
AxesMgmt._DEFAULT_AXIS = {
    offsetBoundary: -1,
    offsetDrawn: false,
    ticks: {
        length: 8,
        numberTicks: 6,
        width: 2
    },
    lineConfig: {
        arrows: {
            /*end: {length: 15, angle: Math.PI/6, filled: false } */
        }
    }
};
AxesMgmt._DEFAULT_LABEL_CONFIG_X = {
    position: LabelPosition.BOTTOM_CENTER,
    lineOffsetFactor: 3.5
};
AxesMgmt._DEFAULT_LABEL_CONFIG_Y = {
    position: LabelPosition.TOP_CENTER,
    lineOffsetFactor: 3.5
};
AxesMgmt._GRID_CONFIG = {
    style: "lightgrey" //?
};
AxesMgmt._LOG_10 = Math.log(10);
export class LineUtils {
    static _getLabelPosition(length, angle, config, ctx) {
        const pos = config.position || LabelPosition.BOTTOM_CENTER;
        const size = 1.2 * (config.size || 10) * (config.lineOffsetFactor || 1);
        const textWidth = ctx.measureText(config.text).width;
        switch (pos) {
            case LabelPosition.BOTTOM_CENTER:
                return [length / 2 - textWidth / 2 * Math.cos(angle), size];
            case LabelPosition.BOTTOM_RIGHT:
                return [length - textWidth * Math.cos(angle), size];
            case LabelPosition.BOTTOM_LEFT:
                return [size, size];
            case LabelPosition.TOP_CENTER:
                return [length / 2 - textWidth / 2 * Math.cos(angle), -size + textWidth * Math.sin(angle)];
            case LabelPosition.TOP_RIGHT:
                return [length - textWidth * Math.cos(angle), -size + textWidth * Math.sin(angle)];
            case LabelPosition.TOP_LEFT:
                return [size, -size + textWidth * Math.sin(angle)];
            case LabelPosition.LEFT:
                return [-size / 2 * (1 - Math.sin(angle)) - textWidth * Math.cos(angle), textWidth / 2 * Math.sin(angle) + size / 4 * Math.cos(angle)];
            case LabelPosition.RIGHT:
                return [length + size, textWidth / 2 * Math.sin(angle)];
        }
    }
    static _toFontString(font) {
        if (!font || typeof font === "string")
            return font;
        let result = "";
        let fresh = true;
        for (const key of LineUtils._FONT_PROPERTIES) {
            let value = font[key];
            if (value) {
                if (!fresh)
                    result += " ";
                else
                    fresh = false;
                result += value;
            }
        }
        return result;
    }
    static _drawLine(ctx, x0, y0, x1, y1, config) {
        var _a, _b, _c, _d, _e;
        const x = x1 - x0;
        const y = y1 - y0;
        ctx.save();
        ctx.translate(x0, y0);
        const angle = Math.atan2(y, x);
        const length = Math.sqrt(x * x + y * y);
        ctx.rotate(angle);
        ctx.strokeStyle = (config === null || config === void 0 ? void 0 : config.style) || "black";
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(length, 0);
        ctx.stroke();
        const arrowStart = ((_a = config === null || config === void 0 ? void 0 : config.arrows) === null || _a === void 0 ? void 0 : _a.start) === true ? LineUtils._DEFAULT_ARROW_CONFIG : (_b = config === null || config === void 0 ? void 0 : config.arrows) === null || _b === void 0 ? void 0 : _b.start;
        if (arrowStart) {
            const arrowX = arrowStart.length * Math.cos(arrowStart.angle);
            const arrowY = arrowStart.length * Math.sin(arrowStart.angle);
            ctx.moveTo(arrowX, arrowY);
            ctx.lineTo(0, 0);
            ctx.lineTo(arrowX, -arrowY);
            if (arrowStart.filled) {
                ctx.closePath();
                ctx.fill();
            }
            else {
                ctx.stroke();
            }
        }
        const arrowEnd = ((_c = config === null || config === void 0 ? void 0 : config.arrows) === null || _c === void 0 ? void 0 : _c.end) === true ? LineUtils._DEFAULT_ARROW_CONFIG : (_d = config === null || config === void 0 ? void 0 : config.arrows) === null || _d === void 0 ? void 0 : _d.end;
        if (arrowEnd) {
            const arrowX = arrowEnd.length * Math.cos(arrowEnd.angle);
            const arrowY = arrowEnd.length * Math.sin(arrowEnd.angle);
            ctx.moveTo(length - arrowX, arrowY);
            ctx.lineTo(length, 0);
            ctx.lineTo(length - arrowX, -arrowY);
            if (arrowEnd.filled) {
                ctx.closePath();
                ctx.fill();
            }
            else {
                ctx.stroke();
            }
        }
        if ((_e = config === null || config === void 0 ? void 0 : config.label) === null || _e === void 0 ? void 0 : _e.text) {
            ctx.beginPath();
            ctx.fillStyle = config.label.style || "black";
            if (config.label.font)
                ctx.font = LineUtils._toFontString(config.label.font);
            const position = LineUtils._getLabelPosition(length, angle, config.label, ctx);
            const rotated = config.label.rotated;
            ctx.translate(position[0], position[1]);
            if (!rotated && angle !== 0)
                ctx.rotate(-angle);
            ctx.fillText(config.label.text, 0, 0);
        }
        ctx.restore();
    }
    /**
     * Draw a static line that does not zoom or pan
     * @param canvas
     * @param x0
     * @param y0
     * @param x1
     * @param y1
     * @param arrowEnd
     * @param arrowStart
     */
    static drawLine(canvas, x0, y0, x1, y1, config) {
        const listener = (state) => LineUtils._drawLine(state.context, x0, y0, x1, y1, config);
        canvas.drawCustom(listener);
        return { close: () => canvas.stopDrawCustom(listener) };
    }
    /**
     * Add one or two coordinate axes to the canvas, consisting of static lines with optional arrow heads and labels, plus
     * ticks that adapt to the zoom and pan state.
     * @param canvas
     * @param config
     */
    static drawAxes(canvas, config) {
        const axes = new AxesMgmt(config || {});
        const listener = axes.draw.bind(axes);
        canvas.drawCustom(listener);
        return { close: () => canvas.stopDrawCustom(listener) };
    }
}
// FontConfig properties
LineUtils._FONT_PROPERTIES = ["style", "weight", "stretch", "size", "family"];
LineUtils._DEFAULT_ARROW_CONFIG = { length: 15, angle: Math.PI / 6, filled: false };
