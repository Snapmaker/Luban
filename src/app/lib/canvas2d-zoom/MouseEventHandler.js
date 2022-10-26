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
var _MouseEventHandler_mouseLeaveListener, _MouseEventHandler_mouseUpListener, _MouseEventHandler_mouseMoveListener, _MouseEventHandler_box, _MouseEventHandler_panMode, _MouseEventHandler_downAnchor, _MouseEventHandler_lastSeen, _MouseEventHandler_doubleClickMode, _MouseEventHandler_mouseLeave, _MouseEventHandler_mouseUp, _MouseEventHandler_mouseMove, _MouseEventHandler_mouseDown;
/**
 * Supports two modes: zoom/pan
 *   - with ctrl key at mousedown: zoom (report selected)
 *   - else pan (report move)
 */
// TODO pinch zoom etc https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events/Pinch_zoom_gestures
export class MouseEventHandler {
    constructor(shadowRoot, element, listener) {
        this.shadowRoot = shadowRoot;
        this.element = element;
        this.listener = listener;
        _MouseEventHandler_mouseLeaveListener.set(this, void 0);
        _MouseEventHandler_mouseUpListener.set(this, void 0);
        _MouseEventHandler_mouseMoveListener.set(this, void 0);
        // draw a dashed box when zooming with Ctrl + mouse
        _MouseEventHandler_box.set(this, null);
        // state 
        _MouseEventHandler_panMode.set(this, false);
        _MouseEventHandler_downAnchor.set(this, null);
        _MouseEventHandler_lastSeen.set(this, null);
        _MouseEventHandler_doubleClickMode.set(this, null);
        _MouseEventHandler_mouseLeave.set(this, (event) => {
            this._removeMouseListeners();
        });
        _MouseEventHandler_mouseUp.set(this, (event) => {
            // FIXME topLeft and bottomRight may be interchanged
            this.listener.selected(__classPrivateFieldGet(this, _MouseEventHandler_downAnchor, "f"), { x: event.offsetX, y: event.offsetY }, __classPrivateFieldGet(this, _MouseEventHandler_panMode, "f"));
            this._removeMouseListeners();
        });
        _MouseEventHandler_mouseMove.set(this, (event) => {
            const vector = { x: event.offsetX - __classPrivateFieldGet(this, _MouseEventHandler_lastSeen, "f").x, y: event.offsetY - __classPrivateFieldGet(this, _MouseEventHandler_lastSeen, "f").y };
            const lastSeen = { x: event.offsetX, y: event.offsetY };
            if (__classPrivateFieldGet(this, _MouseEventHandler_panMode, "f"))
                this.listener.moved(vector);
            else {
                const width = Math.abs(lastSeen.x - __classPrivateFieldGet(this, _MouseEventHandler_downAnchor, "f").x);
                const height = Math.abs(lastSeen.y - __classPrivateFieldGet(this, _MouseEventHandler_downAnchor, "f").y);
                const hasExtension = width > 10 || height > 10;
                let box = __classPrivateFieldGet(this, _MouseEventHandler_box, "f");
                if (hasExtension) {
                    if (!box) {
                        box = document.createElement("div");
                        box.style.position = "absolute";
                        box.style.border = "1px dashed black";
                        box.style.zIndex = "10";
                        this.shadowRoot.appendChild(box);
                        __classPrivateFieldSet(this, _MouseEventHandler_box, box, "f");
                    }
                    box.style.top = Math.min(lastSeen.y, __classPrivateFieldGet(this, _MouseEventHandler_downAnchor, "f").y) + "px";
                    box.style.left = Math.min(lastSeen.x, __classPrivateFieldGet(this, _MouseEventHandler_downAnchor, "f").x) + "px";
                    box.style.width = width + "px";
                    box.style.height = height + "px";
                }
                else if (box) {
                    box.remove();
                    __classPrivateFieldSet(this, _MouseEventHandler_box, null, "f");
                }
            }
            __classPrivateFieldSet(this, _MouseEventHandler_lastSeen, lastSeen, "f");
        });
        // TODO handle double click as zoom event?
        _MouseEventHandler_mouseDown.set(this, (event) => {
            __classPrivateFieldSet(this, _MouseEventHandler_downAnchor, { x: event.offsetX, y: event.offsetY }, "f");
            __classPrivateFieldSet(this, _MouseEventHandler_lastSeen, __classPrivateFieldGet(this, _MouseEventHandler_downAnchor, "f"), "f");
            __classPrivateFieldSet(this, _MouseEventHandler_panMode, !event.ctrlKey, "f");
            this.element.addEventListener("pointermove", __classPrivateFieldGet(this, _MouseEventHandler_mouseMoveListener, "f"));
            this.element.addEventListener("pointerup", __classPrivateFieldGet(this, _MouseEventHandler_mouseUpListener, "f"));
            this.element.addEventListener("pointerleave", __classPrivateFieldGet(this, _MouseEventHandler_mouseLeaveListener, "f"));
            this.element.addEventListener("pointercancel", __classPrivateFieldGet(this, _MouseEventHandler_mouseUpListener, "f"));
        });
        __classPrivateFieldSet(this, _MouseEventHandler_mouseLeaveListener, __classPrivateFieldGet(this, _MouseEventHandler_mouseLeave, "f").bind(this), "f");
        __classPrivateFieldSet(this, _MouseEventHandler_mouseUpListener, __classPrivateFieldGet(this, _MouseEventHandler_mouseUp, "f").bind(this), "f");
        __classPrivateFieldSet(this, _MouseEventHandler_mouseMoveListener, __classPrivateFieldGet(this, _MouseEventHandler_mouseMove, "f").bind(this), "f");
        element.addEventListener("pointerdown", __classPrivateFieldGet(this, _MouseEventHandler_mouseDown, "f").bind(this));
        element.addEventListener("dblclick", event => {
            if (__classPrivateFieldGet(this, _MouseEventHandler_doubleClickMode, "f") === null)
                return;
            switch (__classPrivateFieldGet(this, _MouseEventHandler_doubleClickMode, "f")) {
                case "reset":
                    listener.reset();
                    break;
                case "zoom":
                    listener.zoomed(!event.ctrlKey, { x: event.offsetX, y: event.offsetY });
                    break;
            }
        });
    }
    _removeMouseListeners() {
        var _a;
        this.element.removeEventListener("pointermove", __classPrivateFieldGet(this, _MouseEventHandler_mouseMoveListener, "f"));
        this.element.removeEventListener("pointerleave", __classPrivateFieldGet(this, _MouseEventHandler_mouseLeaveListener, "f"));
        this.element.removeEventListener("pointerup", __classPrivateFieldGet(this, _MouseEventHandler_mouseUpListener, "f"));
        (_a = __classPrivateFieldGet(this, _MouseEventHandler_box, "f")) === null || _a === void 0 ? void 0 : _a.remove();
        __classPrivateFieldSet(this, _MouseEventHandler_downAnchor, null, "f");
        __classPrivateFieldSet(this, _MouseEventHandler_lastSeen, null, "f");
        __classPrivateFieldSet(this, _MouseEventHandler_box, null, "f");
    }
    setDoubleClickMode(mode) {
        __classPrivateFieldSet(this, _MouseEventHandler_doubleClickMode, mode, "f");
    }
    getDoubleClickMode() {
        return __classPrivateFieldGet(this, _MouseEventHandler_doubleClickMode, "f");
    }
}
_MouseEventHandler_mouseLeaveListener = new WeakMap(), _MouseEventHandler_mouseUpListener = new WeakMap(), _MouseEventHandler_mouseMoveListener = new WeakMap(), _MouseEventHandler_box = new WeakMap(), _MouseEventHandler_panMode = new WeakMap(), _MouseEventHandler_downAnchor = new WeakMap(), _MouseEventHandler_lastSeen = new WeakMap(), _MouseEventHandler_doubleClickMode = new WeakMap(), _MouseEventHandler_mouseLeave = new WeakMap(), _MouseEventHandler_mouseUp = new WeakMap(), _MouseEventHandler_mouseMove = new WeakMap(), _MouseEventHandler_mouseDown = new WeakMap();
