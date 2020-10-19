import { NS } from './lib/namespaces';
import {
    setAttributes,
    getBBox
} from './element-utils';

import {
    transformPoint,
    getTransformList,
    transformListToTransform
    // getRotationAngle, hasMatrixTransform
} from './element-transform';

const getMatrix = (elem) => {
    const tlist = getTransformList(elem);
    return transformListToTransform(tlist).matrix;
};

class TextActions {
    curtext = null; // selected element

    textinput = null; // input event?

    blinker = null; // 光标闪烁

    chardata = [];

    textbb = null; // , transbb;

    matrix = null;

    lastX = null;

    lastY = null;

    allowDbl = true;

    constructor(svgContentGroup, scale, jQuery, SVGActions) {
        this.SVGActions = SVGActions;

        this.svgContentGroup = svgContentGroup;

        this.jQuery = jQuery;

        this.scale = scale;

        this.cursor = document.createElementNS(NS.SVG, 'line');
        setAttributes(this.cursor, {
            id: 'text_cursor',
            stroke: '#333',
            'stroke-width': 1
        });
        this.svgContentGroup.appendTextCursor(this.cursor);

        this.svgroot = svgContentGroup.svgContent;

        this.rootSctm = svgContentGroup.getScreenCTM().inverse();
    }

    /**
     *
     * @param {Float} xIn
     * @param {Float} yIn
     * @returns {module:math.XYObject}
     */
    screenToPt(xIn, yIn) {
        const out = {
            x: xIn,
            y: yIn
        };

        out.x /= this.scale;
        out.y /= this.scale;

        if (this.matrix) {
            const pt = transformPoint(out, this.matrix.inverse());
            out.x = pt.x;
            out.y = pt.y;
        }

        return out;
    }

    /**
     *
     * @param {Integer} index
     * @returns {void}
     */
    setCursor(index) {
        const empty = (this.textinput.value === '');
        this.jQuery(this.textinput).focus();

        if (!arguments.length) {
            if (empty) {
                index = 0;
            } else {
                if (this.textinput.selectionEnd !== this.textinput.selectionStart) {
                    return;
                }
                index = this.textinput.selectionEnd;
            }
        }

        const charbb = this.chardata[index];
        if (!empty) {
            this.textinput.setSelectionRange(index, index);
        }
        // this.cursor = this.svgroot.querySelector('text_cursor');

        if (!this.blinker) {
            this.blinker = setInterval(() => {
                const show = (this.cursor.getAttribute('display') === 'none');
                this.cursor.setAttribute('display', show ? 'inline' : 'none');
            }, 600);
        }

        setAttributes(this.cursor, {
            x1: charbb.x,
            y1: charbb.y,
            x2: charbb.x,
            y2: charbb.y + charbb.height,
            visibility: 'visible',
            display: 'inline'
        });

        // curtext may be transformed!
        const list = this.curtext.cloneNode().transform;
        if (list) {
            this.cursor.setAttribute('transform', 'translate(0,0)');
        }
    }

    /**
     *
     * @param {Integer} start
     * @param {Integer} end
     * @param {boolean} skipInput
     * @returns {void}
     */
    setSelection(start, end) {
        this.setCursor(end);
    }

    /**
     *
     * @param {Float} mouseX
     * @param {Float} mouseY
     * @returns {Integer}
     */
    getIndexFromPoint(mouseX, mouseY) {
        // Position cursor here
        let pt = this.svgroot.createSVGPoint();
        pt.x = mouseX;
        pt.y = mouseY;

        const list = this.curtext.cloneNode().transform;
        if (list) {
            pt = pt.matrixTransform(list.baseVal.consolidate().matrix.inverse());
        }
        // No content, so return 0
        if (this.chardata.length === 1) {
            return 0;
        }
        // Determine if cursor should be on left or right of character
        let charpos = this.curtext.getCharNumAtPosition(pt);
        if (charpos < 0) {
            // Out of text range, look at mouse coords
            charpos = this.chardata.length - 2;
            if (mouseX <= this.chardata[0].x) {
                charpos = 0;
            }
        } else if (charpos >= this.chardata.length - 2) {
            charpos = this.chardata.length - 2;
        }
        const charbb = this.chardata[charpos];
        const mid = charbb.x + (charbb.width / 2);
        if (mouseX > mid) {
            charpos++;
        }
        return charpos;
    }

    /**
     *
     * @param {Float} mouseX
     * @param {Float} mouseY
     * @returns {void}
     */
    setCursorFromPoint(mouseX, mouseY) {
        this.setCursor(this.getIndexFromPoint(mouseX, mouseY));
    }

    /**
     *
     * @param {Float} x
     * @param {Float} y
     * @param {boolean} apply
     * @returns {void}
     */
    setEndSelectionFromPoint(x, y, apply) {
        const i1 = this.textinput.selectionStart;
        const i2 = this.getIndexFromPoint(x, y);

        const start = Math.min(i1, i2);
        const end = Math.max(i1, i2);
        this.setSelection(start, end, !apply);
    }

    // Not currently in use
    hideCursor() {
        if (this.cursor) {
            this.cursor.setAttribute('visibility', 'hidden');
        }
    }

    /**
     *
     * @param {Event} evt
     * @returns {void}
     */
    selectWord(evt) {
        if (!this.allowDbl || !this.curtext) {
            return;
        }

        const ept = transformPoint(evt.pageX, evt.pageY, this.rootSctm),
            mouseX = ept.x * this.scale,
            mouseY = ept.y * this.scale;
        const pt = this.screenToPt(mouseX, mouseY);

        const index = this.getIndexFromPoint(pt.x, pt.y);
        const str = this.curtext.textContent;
        const first = str.substr(0, index).replace(/[a-z\d]+$/i, '').length;
        const m = str.substr(index).match(/^[a-z\d]+/i);
        const last = (m ? m[0].length : 0) + index;
        this.setSelection(first, last);
    }

    // actions=
    /**
     * @param {Element} target
     * @param {Float} x
     * @param {Float} y
     * @returns {void}
     */
    select(target, x, y) {
        this.curtext = target;
        this.toEditMode(x, y);
    }

    /**
     * @param {external:MouseEvent} evt
     * @param {Element} mouseTarget
     * @param {Float} startX
     * @param {Float} startY
     * @returns {void}
     */
    mouseDown(evt, mouseTarget, startX, startY) {
        // const pt = screenToPt(startX, startY);
        this.textinput.focus();
        // setCursorFromPoint(startX, startY);
        this.lastX = startX;
        this.lastY = startY;

        // TODO: Find way to block native selection
    }

    /**
     * @param {Float} mouseX
     * @param {Float} mouseY
     * @returns {void}
     */
    // TODO: not used
    mouseMove(mouseX, mouseY) {
        // const pt = screenToPt(mouseX, mouseY);
        this.setEndSelectionFromPoint(mouseX, mouseY);
    }

    /**
     * @param {external:MouseEvent} evt
     * @param {Float} mouseX
     * @param {Float} mouseY
     * @returns {boolean}
     */
    mouseUp(evt, mouseX, mouseY) {
        // TODO: Find a way to make this work: Use transformed BBox instead of evt.target
        if (
            evt.target !== this.curtext
            && mouseX < this.lastX + 2
            && mouseX > this.lastX - 2
            && mouseY < this.lastY + 2
            && mouseY > this.lastY - 2
        ) {
            this.toSelectMode();
            return false;
        } else {
            this.setCursorFromPoint(mouseX, mouseY);
            return true;
        }
    }

    /**
     * @param {Float} x
     * @param {Float} y
     * @returns {void}
     */
    toEditMode(x, y) {
        this.allowDbl = false;
        // not use showGrip(false) because cursor will be hide
        this.svgContentGroup.showSelectorResizeAndRotateGripsAndBox(false);

        // Make selector group accept clicks
        // Do we need this? Has side effect of setting lock, so keeping for now, but next line wasn't being used
        // const selector = selectorManager.requestSelector(curtext);
        // const sel = selector.selectorRect;

        this.init();

        this.jQuery(this.curtext).css('cursor', 'text');

        if (!arguments.length) {
            this.setCursor();
        } else {
            this.setCursorFromPoint(x, y);
        }

        setTimeout(() => {
            this.allowDbl = true;
        }, 300);
    }

    /**
     * @param {boolean|Element} selectElem
     * @fires module:svgcanvas.SvgCanvas#event:selected
     * @returns {void}
     */
    toSelectMode() {
        clearInterval(this.blinker);
        this.blinker = null;
        if (this.cursor) {
            this.jQuery(this.cursor).attr('visibility', 'hidden');
        }
        this.jQuery(this.curtext).css('cursor', 'move');
        // TODO: remove SVGActions, move to flux
        this.SVGActions.resetSelectionNotResetList([this.curtext]);
        this.svgContentGroup.showSelectorGrips(true);

        this.jQuery(this.textinput).blur();

        this.curtext = false;
    }

    /**
     * @param {Element} elem
     * @returns {void}
     */
    setInputElem(input) {
        this.textinput = input;
        this.jQuery(this.textinput).bind('keyup input', (e) => {
            const text = e.target.value;
            // TODO: remove SVGActions, move to flux
            const svgModel = this.SVGActions.getSVGModelByElement(this.curtext);
            svgModel.relatedModel.updateAndRefresh({ config: { text } });
            this.init();
            this.setCursor();
        });

        this.jQuery(this.textinput).blur(this.hideCursor);
    }

    /**
     * @param {Element} inputElem Not in use
     * @returns {void}
     */
    init() {
        if (!this.curtext) {
            return;
        }
        let i, end;

        const str = this.curtext.textContent;
        const len = str.length;

        const xform = this.curtext.getAttribute('transform');

        this.textbb = getBBox(this.curtext);

        this.matrix = xform ? getMatrix(this.curtext) : null;

        this.chardata = [];
        this.chardata.length = len;
        this.textinput.focus();

        this.jQuery(this.curtext).unbind('dblclick', this.selectWord).dblclick(this.selectWord);

        if (!len) {
            end = { x: this.textbb.x + (this.textbb.width / 2), width: 0 };
        }

        for (i = 0; i < len; i++) {
            const start = this.curtext.getStartPositionOfChar(i);
            end = this.curtext.getEndPositionOfChar(i);

            // TODO: Decide if y, width and height are actually necessary
            this.chardata[i] = {
                x: start.x,
                y: this.textbb.y, // start.y?
                width: end.x - start.x,
                height: this.textbb.height
            };
        }

        // Add a last bbox for cursor at end of text
        this.chardata.push({
            x: end.x,
            y: this.textbb.y, // start.y?
            width: 0,
            height: this.textbb.height
        });
        this.setSelection(this.textinput.selectionStart, this.textinput.selectionEnd, true);
        this.jQuery(this.textinput).val(this.curtext.textContent);
    }
}

export default TextActions;
