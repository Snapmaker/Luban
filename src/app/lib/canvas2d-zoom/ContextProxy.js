/* eslint-disable */

var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var _ContextProxy_maxZoom, _ContextProxy_minZoom, _ContextProxy_zoomFactor, _ContextProxy_clearXBorder, _ContextProxy_clearYBorder, _ContextProxy_rectMinWidth, _ContextProxy_rectMinHeight, _ContextProxy_circleMinRadius, _ContextProxy_pipe;
import { MinimumSizeUtils } from "./minSize.js";
export class ContextProxy {
    constructor(_eventDispatcher) {
        this._eventDispatcher = _eventDispatcher;
        // zoom related
        _ContextProxy_maxZoom.set(this, undefined);
        _ContextProxy_minZoom.set(this, undefined);
        _ContextProxy_zoomFactor.set(this, 2);
        _ContextProxy_clearXBorder.set(this, 0);
        _ContextProxy_clearYBorder.set(this, 0);
        // minimum size settings
        _ContextProxy_rectMinWidth.set(this, void 0);
        _ContextProxy_rectMinHeight.set(this, void 0);
        _ContextProxy_circleMinRadius.set(this, void 0);
        // drawing operations
        _ContextProxy_pipe.set(this, []);
    }
    get(target, p) {
        const result = target[p];
        if (typeof result !== "function")
            return result;
        if (typeof p === "string" && p.startsWith("get"))
            return result.bind(target);
        const pipe = __classPrivateFieldGet(this, _ContextProxy_pipe, "f");
        const proxy = this;
        function _internalFunc() {
            let a;
            pipe.push({ target: target, key: p, arguments: arguments, type: "method" });
            return proxy.applyFunction(result.bind(target), p, arguments);
        }
        return _internalFunc;
    }
    set(target, p, value) {
        __classPrivateFieldGet(this, _ContextProxy_pipe, "f").push({ target: target, key: p, type: "property", value: value });
        return target[p] = value;
    }
    applyPipe(trafo) {
        for (const action of __classPrivateFieldGet(this, _ContextProxy_pipe, "f")) {
            const target = action.target;
            const prop = action.key;
            if (action.type === "method") {
                const args = action.arguments;
                // setTransform is special because it does not apply a transformation to the current one, but rather resets it completely
                if (trafo && prop === "setTransform") {
                    const domMatrix = args.length === 1 ? args[0] :
                        { a: args[0], b: args[1], c: args[2], d: args[3], e: args[4], f: args[5] };
                    const newArg = trafo.multiply(domMatrix);
                    target[prop](newArg);
                }
                else if (trafo && prop === "resetTransform") {
                    target.setTransform(trafo);
                }
                else {
                    this.applyFunction(target[prop].bind(target), prop, args, trafo);
                }
            }
            else {
                target[prop] = action.value;
            }
        }
    }
    resetZoom() {
        if (__classPrivateFieldGet(this, _ContextProxy_pipe, "f").length === 0)
            return;
        const ctx = __classPrivateFieldGet(this, _ContextProxy_pipe, "f")[0].target;
        ctx.restore();
        const oldTrafo = ctx.getTransform();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.save();
        const newTrafo = ctx.getTransform();
        ctx.canvas.width = ctx.canvas.width;
        ctx.clearRect(-__classPrivateFieldGet(this, _ContextProxy_clearXBorder, "f"), -__classPrivateFieldGet(this, _ContextProxy_clearYBorder, "f"), ctx.canvas.width + __classPrivateFieldGet(this, _ContextProxy_clearXBorder, "f"), ctx.canvas.height + __classPrivateFieldGet(this, _ContextProxy_clearYBorder, "f"));
        this.applyPipe();
        this._dispatch(ctx, oldTrafo, newTrafo, true, true);
    }
    // FIXME is this efficient? Can we do better?
    _clear(ctx) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(-__classPrivateFieldGet(this, _ContextProxy_clearXBorder, "f"), -__classPrivateFieldGet(this, _ContextProxy_clearYBorder, "f"), ctx.canvas.width + __classPrivateFieldGet(this, _ContextProxy_clearXBorder, "f"), ctx.canvas.height + __classPrivateFieldGet(this, _ContextProxy_clearYBorder, "f"));
        ctx.restore();
    }
    _dispatch(ctx, oldTransform, newTransform, zoom, pan) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        // could make sense to set this to cancelable and prevent the zoom operation from happening in this case....
        this._eventDispatcher.dispatchEvent(new CustomEvent("zoom", {
            bubbles: true,
            composed: true,
            cancelable: false,
            detail: {
                zoom: zoom,
                pan: pan,
                previousTransformation: oldTransform,
                newTransformation: newTransform,
                context: ctx
            }
        }));
        ctx.restore();
    }
    zoom(relativeScale, center) {
        if (__classPrivateFieldGet(this, _ContextProxy_pipe, "f").length === 0)
            return;
        const ctx = __classPrivateFieldGet(this, _ContextProxy_pipe, "f")[0].target;
        ctx.restore();
        const currentTransform = ctx.getTransform();
        if (currentTransform.a * relativeScale > __classPrivateFieldGet(this, _ContextProxy_maxZoom, "f") || currentTransform.a * relativeScale < __classPrivateFieldGet(this, _ContextProxy_minZoom, "f")) {
            ctx.save();
            return;
        }
        const domMatrix = currentTransform.inverse();
        const translationVector = domMatrix.transformPoint(center);
        this._clear(ctx);
        ctx.translate(translationVector.x, translationVector.y);
        ctx.scale(relativeScale, relativeScale);
        ctx.translate(-translationVector.x, -translationVector.y);
        ctx.save();
        const trafo = ctx.getTransform();
        this.applyPipe(trafo);
        this._dispatch(ctx, currentTransform, trafo, true, false);
    }
    translate(x, y) {
        if (__classPrivateFieldGet(this, _ContextProxy_pipe, "f").length === 0)
            return;
        const ctx = __classPrivateFieldGet(this, _ContextProxy_pipe, "f")[0].target;
        ctx.restore();
        const oldTransform = ctx.getTransform();
        this._clear(ctx);
        ctx.translate(x, y);
        ctx.save();
        const trafo = ctx.getTransform();
        this.applyPipe(trafo);
        this._dispatch(ctx, oldTransform, trafo, false, true);
    }
    wheel(event) {
        // TODO take into account deltaY magnitude
        const relativeScale = event.deltaY < 0 ? __classPrivateFieldGet(this, _ContextProxy_zoomFactor, "f") : 1 / __classPrivateFieldGet(this, _ContextProxy_zoomFactor, "f");
        this.zoom(relativeScale, { x: event.offsetX, y: event.offsetY });
    }
    setMaxZoom(zoom) {
        __classPrivateFieldSet(this, _ContextProxy_maxZoom, zoom > 0 ? zoom : undefined, "f");
        //if (this.#scale > this.#maxZoom) // TODO
    }
    setMinZoom(zoom) {
        __classPrivateFieldSet(this, _ContextProxy_minZoom, zoom > 0 ? zoom : undefined, "f");
        //if (this.#scale < this.#minZoom) // TODO
    }
    getMaxZoom() {
        return __classPrivateFieldGet(this, _ContextProxy_maxZoom, "f");
    }
    getMinZoom() {
        return __classPrivateFieldGet(this, _ContextProxy_minZoom, "f");
    }
    setZoomFactor(factor) {
        if (!(factor > 0) || !isFinite(factor))
            throw new Error("Invalid zoom factor " + factor);
        __classPrivateFieldSet(this, _ContextProxy_zoomFactor, factor, "f");
    }
    getZoomFactor() {
        return __classPrivateFieldGet(this, _ContextProxy_zoomFactor, "f");
    }
    setOverlap(x, y) {
        if (isFinite(x))
            __classPrivateFieldSet(this, _ContextProxy_clearXBorder, x, "f");
        if (isFinite(y))
            __classPrivateFieldSet(this, _ContextProxy_clearYBorder, y, "f");
    }
    getOverlap() {
        return [__classPrivateFieldGet(this, _ContextProxy_clearXBorder, "f"), __classPrivateFieldGet(this, _ContextProxy_clearYBorder, "f")];
    }
    setRectMinWidth(width) {
        __classPrivateFieldSet(this, _ContextProxy_rectMinWidth, width, "f");
    }
    getRectMinWidth() {
        return __classPrivateFieldGet(this, _ContextProxy_rectMinWidth, "f");
    }
    setRectMinHeight(height) {
        __classPrivateFieldSet(this, _ContextProxy_rectMinHeight, height, "f");
    }
    getRectMinHeight() {
        return __classPrivateFieldGet(this, _ContextProxy_rectMinHeight, "f");
    }
    setCircleMinRadius(radius) {
        __classPrivateFieldSet(this, _ContextProxy_circleMinRadius, radius, "f");
    }
    getCircleMinRadius() {
        return __classPrivateFieldGet(this, _ContextProxy_circleMinRadius, "f");
    }
    pipe() {
        return __classPrivateFieldGet(this, _ContextProxy_pipe, "f");
    }
    redraw() {
        if (__classPrivateFieldGet(this, _ContextProxy_pipe, "f").length === 0)
            return;
        const ctx = __classPrivateFieldGet(this, _ContextProxy_pipe, "f")[0].target;
        ctx.restore();
        const currentTransform = ctx.getTransform();
        this.applyPipe(currentTransform);
        ctx.save();
        this._dispatch(ctx, currentTransform, currentTransform, false, false);
    }
    applyFunction(fun, key, args, trafo) {
        if (key === "arc" && __classPrivateFieldGet(this, _ContextProxy_circleMinRadius, "f")) {
            // @ts-ignore
            args = MinimumSizeUtils.arc(__classPrivateFieldGet(this, _ContextProxy_circleMinRadius, "f"), args, trafo);
        }
        // @ts-ignore
        else if (["rect", "fillRect", "strokeRect"].indexOf(key) >= 0 && (__classPrivateFieldGet(this, _ContextProxy_rectMinHeight, "f") || __classPrivateFieldGet(this, _ContextProxy_rectMinWidth, "f"))) {
            // @ts-ignore
            args = MinimumSizeUtils.rect(__classPrivateFieldGet(this, _ContextProxy_rectMinWidth, "f"), __classPrivateFieldGet(this, _ContextProxy_rectMinHeight, "f"), args, trafo);
        }
        return fun(...args);
    }
}
_ContextProxy_maxZoom = new WeakMap(), _ContextProxy_minZoom = new WeakMap(), _ContextProxy_zoomFactor = new WeakMap(), _ContextProxy_clearXBorder = new WeakMap(), _ContextProxy_clearYBorder = new WeakMap(), _ContextProxy_rectMinWidth = new WeakMap(), _ContextProxy_rectMinHeight = new WeakMap(), _ContextProxy_circleMinRadius = new WeakMap(), _ContextProxy_pipe = new WeakMap();
