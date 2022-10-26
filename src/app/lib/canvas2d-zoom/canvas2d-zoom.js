/* eslint-disable */

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
var _Canvas2dZoom_canvas, _Canvas2dZoom_proxy, _Canvas2dZoom_zoomListener, _Canvas2dZoom_noopZoomListener, _Canvas2dZoom_mouseListener, _Canvas2dZoom_mouseHandler, _Canvas2dZoom_keyEventListener, _Canvas2dZoom_zoomListeners, _Canvas2dZoom_zoom, _Canvas2dZoom_lastFocusPoint, _Canvas2dZoom_pan;
import { ContextProxy } from "./ContextProxy.js";
import { MouseEventHandler } from "./MouseEventHandler.js";
/**
 * A webcomponent that wraps a 2D HTML canvas element, making it zoomable and pannable.
 * The default tag name is "canvas2d-zoom".
 * Usage: add a tag <canvas2d-zoom> to your HTML, import this module in Javascript and call Canvas2dZoom.register() once.
 * Drawing on the canvas should work like for ordinary 2D canvas, i.e. (in typescript, for javascript remove types)
 * <code>
 *      Canvas2dZoom.register();
 *      const canvas: Canvas2dZoom = document.querySelector("canvas2d-zoom");
 *      const ctx: CanvasRenderingContext2D = canvas.getContext("2d");
 *      ctx.beginPath();
 *      ...
 * </code>
 */
export class Canvas2dZoom extends HTMLElement {
    constructor() {
        super();
        _Canvas2dZoom_canvas.set(this, void 0);
        _Canvas2dZoom_proxy.set(this, void 0);
        _Canvas2dZoom_zoomListener.set(this, void 0);
        _Canvas2dZoom_noopZoomListener.set(this, (event) => event.preventDefault());
        _Canvas2dZoom_mouseListener.set(this, void 0);
        _Canvas2dZoom_mouseHandler.set(this, void 0);
        _Canvas2dZoom_keyEventListener.set(this, void 0);
        // keys: passed listeners, values: internal listeners
        _Canvas2dZoom_zoomListeners.set(this, new WeakMap());
        _Canvas2dZoom_zoom.set(this, true);
        _Canvas2dZoom_lastFocusPoint.set(this, null);
        _Canvas2dZoom_pan.set(this, true);
        __classPrivateFieldSet(this, _Canvas2dZoom_canvas, document.createElement("canvas"), "f");
        __classPrivateFieldSet(this, _Canvas2dZoom_proxy, new ContextProxy(this), "f");
        __classPrivateFieldSet(this, _Canvas2dZoom_zoomListener, __classPrivateFieldGet(this, _Canvas2dZoom_proxy, "f").wheel.bind(__classPrivateFieldGet(this, _Canvas2dZoom_proxy, "f")), "f");
        __classPrivateFieldGet(this, _Canvas2dZoom_canvas, "f").addEventListener("wheel", __classPrivateFieldGet(this, _Canvas2dZoom_noopZoomListener, "f"));
        const keyListener = (event) => {
            const isZoom = event.key === "+" || event.key === "-";
            const isZoomReset = event.key === "Enter";
            const isTranslation = event.key.startsWith("Arrow");
            if (event.ctrlKey && (((isZoom || isZoomReset) && __classPrivateFieldGet(this, _Canvas2dZoom_zoom, "f")) || (isTranslation && __classPrivateFieldGet(this, _Canvas2dZoom_pan, "f")))) {
                event.preventDefault();
                if (isZoom) {
                    const factor = __classPrivateFieldGet(this, _Canvas2dZoom_proxy, "f").getZoomFactor();
                    this.applyZoom(event.key === "+" ? factor : 1 / factor, __classPrivateFieldGet(this, _Canvas2dZoom_lastFocusPoint, "f"));
                }
                else if (isZoomReset) {
                    this.resetZoomPan();
                }
                else if (isTranslation) {
                    // TODO configurable translation step?
                    const vector = event.key === "ArrowUp" ? { x: 0, y: 10 } :
                        event.key === "ArrowDown" ? { x: 0, y: -10 } :
                            event.key === "ArrowLeft" ? { x: 10, y: 0 } :
                                event.key === "ArrowRight" ? { x: -10, y: 0 } : { x: 0, y: 0 };
                    this.applyTranslation(vector.x, vector.y);
                }
            }
        };
        __classPrivateFieldSet(this, _Canvas2dZoom_keyEventListener, keyListener.bind(this), "f");
        this.addEventListener("focus", () => document.addEventListener("keydown", __classPrivateFieldGet(this, _Canvas2dZoom_keyEventListener, "f")));
        this.addEventListener("blur", () => {
            document.removeEventListener("keydown", __classPrivateFieldGet(this, _Canvas2dZoom_keyEventListener, "f"));
            __classPrivateFieldSet(this, _Canvas2dZoom_lastFocusPoint, null, "f");
        });
        __classPrivateFieldGet(this, _Canvas2dZoom_canvas, "f").addEventListener("wheel", __classPrivateFieldGet(this, _Canvas2dZoom_zoomListener, "f"));
        __classPrivateFieldSet(this, _Canvas2dZoom_mouseListener, {
            moved: (vector) => {
                if (__classPrivateFieldGet(this, _Canvas2dZoom_pan, "f")) {
                    const trafo = __classPrivateFieldGet(this, _Canvas2dZoom_canvas, "f").getContext("2d").getTransform();
                    this.applyTranslation(vector.x / trafo.a, vector.y / trafo.d);
                }
            },
            selected: (topLeft, bottomRight, panMode) => {
                const diffx = Math.abs(topLeft.x - bottomRight.x);
                const diffy = Math.abs(topLeft.y - bottomRight.y);
                const midx = (topLeft.x + bottomRight.x) / 2;
                const midy = (topLeft.y + bottomRight.y) / 2;
                __classPrivateFieldSet(this, _Canvas2dZoom_lastFocusPoint, { x: midx, y: midy }, "f");
                if (!__classPrivateFieldGet(this, _Canvas2dZoom_zoom, "f") || panMode || (diffx < 5 && diffy < 5))
                    return;
                const fracx = diffx / __classPrivateFieldGet(this, _Canvas2dZoom_canvas, "f").width;
                const fracy = diffy / __classPrivateFieldGet(this, _Canvas2dZoom_canvas, "f").height;
                const frac = Math.max(fracx, fracy);
                if (frac >= 1)
                    return;
                this.applyZoom(1 / frac, { x: midx, y: midy });
            },
            reset: () => this.resetZoomPan(),
            zoomed: (inOrOut, center) => this.applyZoom(inOrOut ? 2 : 0.5, center)
        }, "f");
        const style = document.createElement("style");
        style.textContent = ":host { position: relative; display: block; }";
        const shadow = this.attachShadow({ mode: "open" });
        shadow.appendChild(style);
        shadow.appendChild(__classPrivateFieldGet(this, _Canvas2dZoom_canvas, "f"));
        __classPrivateFieldSet(this, _Canvas2dZoom_mouseHandler, new MouseEventHandler(shadow, this, __classPrivateFieldGet(this, _Canvas2dZoom_mouseListener, "f")), "f");
    }
    static get observedAttributes() {
        return ["debug", "width", "height", "zoom", "pan", "max-zoom", "min-zoom", "zoom-factor", "double-click-mode",
            "circle-min-radius", "rect-min-width", "rect-min-height"];
    }
    /**
     * Call once to register the new tag type "<canvas2d-zoom></canvas2d-zoom>"
     * @param tag
     */
    static register(tag) {
        tag = tag || Canvas2dZoom.DEFAULT_TAG;
        if (tag !== Canvas2dZoom._tag) {
            customElements.define(tag, Canvas2dZoom);
            Canvas2dZoom._tag = tag;
        }
    }
    /**
     * Retrieve the registered tag type for this element type, or undefined if not registered yet.
     */
    static tag() {
        return Canvas2dZoom._tag;
    }
    // =============== Properties ===============
    //  They are all reflected by attributes
    get debug() {
        var _a;
        return ((_a = this.getAttribute("debug")) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === "true";
    }
    /**
     * Gets or sets the debug property. If set to true, some debug methods will be available on the HTMLElement. Default: false.
     */
    set debug(debug) {
        this.setAttribute("debug", debug + "");
    }
    get width() {
        return __classPrivateFieldGet(this, _Canvas2dZoom_canvas, "f").width;
    }
    /**
     * Gets or sets the width of a canvas element on a document.
     */
    set width(width) {
        this.setAttribute("width", width + "");
    }
    get height() {
        return __classPrivateFieldGet(this, _Canvas2dZoom_canvas, "f").height;
    }
    /**
     * Gets or sets the height of a canvas element on a document.
     */
    set height(height) {
        this.setAttribute("height", height + "");
    }
    _setZoomInternal(zoom) {
        if (zoom === __classPrivateFieldGet(this, _Canvas2dZoom_zoom, "f"))
            return;
        __classPrivateFieldSet(this, _Canvas2dZoom_zoom, zoom, "f");
        if (zoom)
            __classPrivateFieldGet(this, _Canvas2dZoom_canvas, "f").addEventListener("wheel", __classPrivateFieldGet(this, _Canvas2dZoom_zoomListener, "f"));
        else
            __classPrivateFieldGet(this, _Canvas2dZoom_canvas, "f").removeEventListener("wheel", __classPrivateFieldGet(this, _Canvas2dZoom_zoomListener, "f"));
    }
    get zoom() {
        return __classPrivateFieldGet(this, _Canvas2dZoom_zoom, "f");
    }
    /**
     * Controls whether the user can zoom in and out on the canvas. Default: true.
     */
    set zoom(zoom) {
        this.setAttribute("zoom", zoom + "");
    }
    _setPanInternal(pan) {
        if (pan === __classPrivateFieldGet(this, _Canvas2dZoom_pan, "f"))
            return;
        __classPrivateFieldSet(this, _Canvas2dZoom_pan, pan, "f");
    }
    get pan() {
        return __classPrivateFieldGet(this, _Canvas2dZoom_pan, "f");
    }
    /**
     * Controls whether the user can pan/move the canvas. Default: true.
     */
    set pan(pan) {
        this.setAttribute("pan", pan + "");
    }
    get maxZoom() {
        return __classPrivateFieldGet(this, _Canvas2dZoom_proxy, "f").getMaxZoom();
    }
    /**
     * Controls the maximum zoom level of the canvas. A number > 1. Default: undefined
     */
    set maxZoom(max) {
        if (isFinite(max))
            this.setAttribute("max-zoom", max + "");
        else
            this.removeAttribute("max-zoom");
    }
    get minZoom() {
        return __classPrivateFieldGet(this, _Canvas2dZoom_proxy, "f").getMinZoom();
    }
    /**
     * Controls the minimum zoom level of the canvas. A number < 1. Default: undefined
     */
    set minZoom(min) {
        if (isFinite(min))
            this.setAttribute("min-zoom", min + "");
        else
            this.removeAttribute("min-zoom");
        //this.#proxy.setMinZoom(min);
    }
    get zoomFactor() {
        return __classPrivateFieldGet(this, _Canvas2dZoom_proxy, "f").getZoomFactor();
    }
    /**
     * The zoom factor determines how fast the zoom effect is, larger values lead to faster zoom.
     * A positive number, usually greater than 1. Default value: 2.
     */
    set zoomFactor(factor) {
        this.setAttribute("zoom-factor", factor + "");
    }
    get overlapX() {
        return __classPrivateFieldGet(this, _Canvas2dZoom_proxy, "f").getOverlap()[0];
    }
    get overlapY() {
        return __classPrivateFieldGet(this, _Canvas2dZoom_proxy, "f").getOverlap()[1];
    }
    /**
     * Indicates that upon zoom or pan operations a region beyond the horizontal vertical borders
     * of the canvas needs to be cleared (for positive values), resp. a certain area within
     * the visible range shall not be cleared (for negative values). Default: 0.
     */
    set overlapX(pixels) {
        this.setAttribute("overlap-x", pixels + "");
    }
    /**
     * Indicates that upon zoom or pan operations a region beyond the visible vertical borders
     * of the canvas needs to be cleared (for positive values), resp. a certain area within
     * the visible range shall not be cleared (for negative values). Default: 0.
     */
    set overlapY(pixels) {
        this.setAttribute("overlap-y", pixels + "");
    }
    get doubleClickMode() {
        return __classPrivateFieldGet(this, _Canvas2dZoom_mouseHandler, "f").getDoubleClickMode();
    }
    /**
     * Define action on double click of the user.
     * "reset" => reset zoom and pan
     * "zoom"  => zoom in (or out if ctrl key is pressed at the same time)
     * null (default) => no action
     */
    set doubleClickMode(mode) {
        if (!mode)
            this.removeAttribute("double-click-mode");
        else
            this.setAttribute("double-click-mode", mode);
    }
    /**
     * Set a minimum width for rectangles; when zooming out and the limit is hit,
     * the rectangle width will not shrink any further.
     */
    set rectMinWidth(width) {
        if (width)
            this.setAttribute("rect-min-width", width + "");
        else
            this.removeAttribute("rect-min-width");
    }
    get rectMinWidth() {
        return __classPrivateFieldGet(this, _Canvas2dZoom_proxy, "f").getRectMinWidth();
    }
    /**
     * Set a minimum height for rectangles; when zooming out and the limit is hit,
     * the rectangle height will not shrink any further.
     */
    set rectMinHeight(height) {
        if (height)
            this.setAttribute("rect-min-height", height + "");
        else
            this.removeAttribute("rect-min-height");
    }
    get rectMinHeight() {
        return __classPrivateFieldGet(this, _Canvas2dZoom_proxy, "f").getRectMinHeight();
    }
    /**
     * Set a minimum radius for circles/arcs; when zooming out and the limit is hit,
     * the radius will not shrink any further.
     */
    set circleMinRadius(radius) {
        if (radius)
            this.setAttribute("circle-min-radius", radius + "");
        else
            this.removeAttribute("circle-min-radius");
    }
    get circleMinRadius() {
        return __classPrivateFieldGet(this, _Canvas2dZoom_proxy, "f").getCircleMinRadius();
    }
    // ============= Internal methods ===============
    connectedCallback() {
        if (!this.hasAttribute("tabindex"))
            this.setAttribute("tabindex", "0"); // make the element focusable; attributes must not be set in constructor
        __classPrivateFieldGet(this, _Canvas2dZoom_canvas, "f").getContext("2d").save();
    }
    disconnectedCallback() {
        __classPrivateFieldGet(this, _Canvas2dZoom_canvas, "f").getContext("2d").restore();
    }
    attributeChangedCallback(name, oldValue, newValue) {
        return __awaiter(this, void 0, void 0, function* () {
            const attr = name.toLowerCase();
            switch (attr) {
                case "zoom":
                    this._setZoomInternal((newValue === null || newValue === void 0 ? void 0 : newValue.toLowerCase()) !== "false");
                    break;
                case "pan":
                    this._setPanInternal((newValue === null || newValue === void 0 ? void 0 : newValue.toLowerCase()) !== "false");
                    break;
                case "max-zoom":
                    const maxZoom = parseFloat(newValue);
                    __classPrivateFieldGet(this, _Canvas2dZoom_proxy, "f").setMaxZoom(maxZoom);
                    break;
                case "min-zoom":
                    //this.minZoom = parseFloat(newValue);
                    const minZoom = parseFloat(newValue);
                    __classPrivateFieldGet(this, _Canvas2dZoom_proxy, "f").setMinZoom(minZoom);
                    break;
                case "zoom-factor":
                    const factor = parseFloat(newValue);
                    if (factor > 0 && isFinite(factor))
                        __classPrivateFieldGet(this, _Canvas2dZoom_proxy, "f").setZoomFactor(factor);
                    break;
                case "double-click-mode":
                    const dcm = newValue === null || newValue === void 0 ? void 0 : newValue.toLowerCase();
                    const dcmValue = dcm === "reset" || dcm === "zoom" ? dcm : null;
                    __classPrivateFieldGet(this, _Canvas2dZoom_mouseHandler, "f").setDoubleClickMode(dcmValue);
                    break;
                case "debug":
                    const debug = (newValue === null || newValue === void 0 ? void 0 : newValue.toLowerCase()) === "true";
                    if (debug) {
                        this.pipe = __classPrivateFieldGet(this, _Canvas2dZoom_proxy, "f").pipe.bind(__classPrivateFieldGet(this, _Canvas2dZoom_proxy, "f"));
                        this.redraw = __classPrivateFieldGet(this, _Canvas2dZoom_proxy, "f").redraw.bind(__classPrivateFieldGet(this, _Canvas2dZoom_proxy, "f"));
                    }
                    else {
                        delete this.pipe;
                        delete this.redraw;
                    }
                    break;
                case "overlap-x":
                case "overlap-y":
                    const overlap = parseFloat(newValue);
                    if (!isFinite(overlap))
                        throw new Error("Invalid attribute " + attr + ": " + newValue);
                    __classPrivateFieldGet(this, _Canvas2dZoom_proxy, "f").setOverlap(attr === "overlap-x" ? overlap : undefined, attr === "overlap-y" ? overlap : undefined);
                case "rect-min-width":
                    __classPrivateFieldGet(this, _Canvas2dZoom_proxy, "f").setRectMinWidth(parseFloat(newValue) || undefined);
                    break;
                case "rect-min-height":
                    __classPrivateFieldGet(this, _Canvas2dZoom_proxy, "f").setRectMinHeight(parseFloat(newValue) || undefined);
                    break;
                case "circle-min-radius":
                    __classPrivateFieldGet(this, _Canvas2dZoom_proxy, "f").setCircleMinRadius(parseFloat(newValue) || undefined);
                    break;
                case "width":
                case "height":
                // fallthrough
                default:
                    __classPrivateFieldGet(this, _Canvas2dZoom_canvas, "f").setAttribute(name, newValue);
            }
        });
    }
    // ============= API ===============
    /**
     * Returns an object that provides methods and properties for drawing and manipulating images and graphics on a
     * 2D canvas element in a document. A context object includes information about colors, line widths, fonts, and
     * other graphic parameters that can be drawn on a canvas.
     * (from HTMLCanvasElement)
     * @param type
     * @param options
     */
    getContext(type, options) {
        if (type !== "2d")
            throw new Error("This canvas only supports 2d mode, invalid context id " + type);
        return new Proxy(__classPrivateFieldGet(this, _Canvas2dZoom_canvas, "f").getContext("2d", options), __classPrivateFieldGet(this, _Canvas2dZoom_proxy, "f"));
    }
    /**
     * Returns the wrapped canvas element.
     */
    canvas() {
        const c2d = this;
        return new Proxy(__classPrivateFieldGet(this, _Canvas2dZoom_canvas, "f"), {
            get(target, p) {
                if (p === "getContext")
                    return c2d.getContext.bind(c2d);
                const result = target[p];
                return typeof result === "function" ? result.bind(target) : result;
            }
        });
    }
    /**
     * Reset zoom to its initial value.
     */
    resetZoomPan() {
        __classPrivateFieldGet(this, _Canvas2dZoom_proxy, "f").resetZoom();
    }
    /**
     * Zoom the canvas
     * @param scale a number > 0; to zoom in, provide a value > 1 (2 is a good example), to zoom out provide a value < 1 (e.g. 0.5)
     * @param center center/focus coordinates; typical x range: [0, canvas width/px], typical y range: [0, canvas height/px].
     *      If not provided, the canvas center is used as zoom center
     */
    applyZoom(scale, center) {
        if (!center)
            center = { x: __classPrivateFieldGet(this, _Canvas2dZoom_canvas, "f").width / 2, y: __classPrivateFieldGet(this, _Canvas2dZoom_canvas, "f").height / 2 };
        __classPrivateFieldGet(this, _Canvas2dZoom_proxy, "f").zoom(scale, center);
    }
    /**
     * Move/pan/translate the canvas.
     * @param x
     * @param y
     */
    applyTranslation(x, y) {
        __classPrivateFieldGet(this, _Canvas2dZoom_proxy, "f").translate(x, y);
    }
    /**
     * Use this method for drawing elements with custom scaling and pan behaviour, or completely static elements.
     * The listener will be called once with the current state and then on every state change.
     * @param listener
     */
    drawCustom(listener) {
        if (__classPrivateFieldGet(this, _Canvas2dZoom_zoomListeners, "f").has(listener))
            return;
        const ctx = __classPrivateFieldGet(this, _Canvas2dZoom_canvas, "f").getContext("2d");
        listener({
            context: ctx,
            newTransformation: ctx.getTransform(),
            previousTransformation: ctx.getTransform(),
            zoom: false,
            pan: false
        }, __classPrivateFieldGet(this, _Canvas2dZoom_canvas, "f").width, __classPrivateFieldGet(this, _Canvas2dZoom_canvas, "f").height);
        const internalListener = (event) => listener(event.detail, __classPrivateFieldGet(event.currentTarget, _Canvas2dZoom_canvas, "f").width, __classPrivateFieldGet(event.currentTarget, _Canvas2dZoom_canvas, "f").height);
        __classPrivateFieldGet(this, _Canvas2dZoom_zoomListeners, "f").set(listener, internalListener);
        this.addEventListener("zoom", internalListener);
    }
    /**
     * Remove a zoom listener
     * @param listener
     */
    stopDrawCustom(listener) {
        const internalListener = __classPrivateFieldGet(this, _Canvas2dZoom_zoomListeners, "f").get(listener);
        if (internalListener)
            this.removeEventListener("zoom", internalListener);
    }
}
_Canvas2dZoom_canvas = new WeakMap(), _Canvas2dZoom_proxy = new WeakMap(), _Canvas2dZoom_zoomListener = new WeakMap(), _Canvas2dZoom_noopZoomListener = new WeakMap(), _Canvas2dZoom_mouseListener = new WeakMap(), _Canvas2dZoom_mouseHandler = new WeakMap(), _Canvas2dZoom_keyEventListener = new WeakMap(), _Canvas2dZoom_zoomListeners = new WeakMap(), _Canvas2dZoom_zoom = new WeakMap(), _Canvas2dZoom_lastFocusPoint = new WeakMap(), _Canvas2dZoom_pan = new WeakMap();
Canvas2dZoom.DEFAULT_TAG = "canvas2d-zoom";
