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

const textActionCreator = (canvas, $) => {
    /* eslint-enable jsdoc/require-property */
    let curtext;
    let textinput;
    let cursor;
    let selblock;
    let blinker;
    let chardata = [];
    let textbb; // , transbb;
    let matrix;
    let lastX, lastY;
    let allowDbl;
    const svgroot = canvas.svgContent;
    const getElem = (id) => {
        return svgroot.querySelector(`#${id}`);
    };

    const selectorManager = canvas.svgContentGroup.selectorManager;
    const rootSctm = canvas.svgContentGroup.getScreenCTM().inverse();
    /**
     *
     * @param {Float} xIn
     * @param {Float} yIn
     * @returns {module:math.XYObject}
     */
    function screenToPt(xIn, yIn) {
        const out = {
            x: xIn,
            y: yIn
        };

        out.x /= canvas.scale;
        out.y /= canvas.scale;

        if (matrix) {
            const pt = transformPoint(out, matrix.inverse());
            out.x = pt.x;
            out.y = pt.y;
        }

        return out;
    }

    // /**
    //  *
    //  * @param {Float} xIn
    //  * @param {Float} yIn
    //  * @returns {module:math.XYObject}
    //  */
    // function ptToScreen(xIn, yIn) {
    //     const out = {
    //         x: xIn,
    //         y: yIn
    //     };

    //     if (matrix) {
    //         const pt = transformPoint(out, matrix);
    //         out.x = pt.x;
    //         out.y = pt.y;
    //     }

    //     out.x *= canvas.scale;
    //     out.y *= canvas.scale;

    //     return out;
    // }


    /**
     *
     * @param {Integer} index
     * @returns {void}
     */
    function setCursor(index) {
        const empty = (textinput.value === '');
        $(textinput).focus();

        if (!arguments.length) {
            if (empty) {
                index = 0;
            } else {
                if (textinput.selectionEnd !== textinput.selectionStart) { return; }
                index = textinput.selectionEnd;
            }
        }

        const charbb = chardata[index];
        if (!empty) {
            textinput.setSelectionRange(index, index);
        }
        cursor = getElem('text_cursor');
        if (!cursor) {
            cursor = document.createElementNS(NS.SVG, 'line');
            setAttributes(cursor, {
                id: 'text_cursor',
                stroke: '#333',
                'stroke-width': 1
            });
            cursor = canvas.svgContentGroup.selectorManager.selectorParentGroup.appendChild(cursor);
        }

        if (!blinker) {
            blinker = setInterval(() => {
                const show = (cursor.getAttribute('display') === 'none');
                cursor.setAttribute('display', show ? 'inline' : 'none');
            }, 600);
        }

        setAttributes(cursor, {
            x1: charbb.x,
            y1: charbb.y,
            x2: charbb.x,
            y2: charbb.y + charbb.height,
            visibility: 'visible',
            display: 'inline'
        });

        // curtext may be transformed!
        const list = curtext.cloneNode().transform;
        if (list) {
            cursor.setAttribute('transform', 'translate(0,0)');
            cursor.transform.baseVal.appendItem(list.baseVal.consolidate());
        }
        if (selblock) { selblock.setAttribute('d', ''); }
    }

    /**
     *
     * @param {Integer} start
     * @param {Integer} end
     * @param {boolean} skipInput
     * @returns {void}
     */
    function setSelection(start, end) {
        setCursor(end);

        // if (!skipInput) {
        //     textinput.setSelectionRange(start, end);
        // }

        // selblock = getElem('text_selectblock');
        // if (!selblock) {
        //     selblock = document.createElementNS(NS.SVG, 'path');
        //     setAttributes(selblock, {
        //         id: 'text_selectblock',
        //         fill: 'green',
        //         opacity: 0.5,
        //         style: 'pointer-events:none'
        //     });
        //     canvas.svgContentGroup.selectorManager.selectorParentGroup.append(selblock);
        // }

        // const startbb = chardata[start];
        // const endbb = chardata[end];

        // cursor.setAttribute('visibility', 'hidden');

        // const tl = ptToScreen(startbb.x, textbb.y),
        //     tr = ptToScreen(startbb.x + (endbb.x - startbb.x), textbb.y),
        //     bl = ptToScreen(startbb.x, textbb.y + textbb.height),
        //     br = ptToScreen(startbb.x + (endbb.x - startbb.x), textbb.y + textbb.height);

        // const dstr = `M${tl.x},${tl.y
        // } L${tr.x},${tr.y
        // } ${br.x},${br.y
        // } ${bl.x},${bl.y}z`;

        // setAttributes(selblock, {
        //     d: dstr,
        //     display: 'inline'
        // });
    }

    /**
     *
     * @param {Float} mouseX
     * @param {Float} mouseY
     * @returns {Integer}
     */
    function getIndexFromPoint(mouseX, mouseY) {
        // Position cursor here
        let pt = svgroot.createSVGPoint();
        pt.x = mouseX;
        pt.y = mouseY;

        const list = curtext.cloneNode().transform;
        if (list) {
            pt = pt.matrixTransform(list.baseVal.consolidate().matrix.inverse());
        }
        // No content, so return 0
        if (chardata.length === 1) { return 0; }
        // Determine if cursor should be on left or right of character
        let charpos = curtext.getCharNumAtPosition(pt);
        if (charpos < 0) {
        // Out of text range, look at mouse coords
            charpos = chardata.length - 2;
            if (mouseX <= chardata[0].x) {
                charpos = 0;
            }
        } else if (charpos >= chardata.length - 2) {
            charpos = chardata.length - 2;
        }
        const charbb = chardata[charpos];
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
    function setCursorFromPoint(mouseX, mouseY) {
        setCursor(getIndexFromPoint(mouseX, mouseY));
    }

    /**
     *
     * @param {Float} x
     * @param {Float} y
     * @param {boolean} apply
     * @returns {void}
     */
    function setEndSelectionFromPoint(x, y, apply) {
        const i1 = textinput.selectionStart;
        const i2 = getIndexFromPoint(x, y);

        const start = Math.min(i1, i2);
        const end = Math.max(i1, i2);
        setSelection(start, end, !apply);
    }


    // Not currently in use
    function hideCursor() {
        if (cursor) {
            cursor.setAttribute('visibility', 'hidden');
        }
    }


    /**
     *
     * @param {Event} evt
     * @returns {void}
     */
    function selectAll(evt) {
        setSelection(0, curtext.textContent.length);
        $(this).unbind(evt);
    }

    /**
     *
     * @param {Event} evt
     * @returns {void}
     */
    function selectWord(evt) {
        if (!allowDbl || !curtext) { return; }

        const ept = transformPoint(evt.pageX, evt.pageY, rootSctm),
            mouseX = ept.x * canvas.scale,
            mouseY = ept.y * canvas.scale;
        const pt = screenToPt(mouseX, mouseY);

        const index = getIndexFromPoint(pt.x, pt.y);
        const str = curtext.textContent;
        const first = str.substr(0, index).replace(/[a-z\d]+$/i, '').length;
        const m = str.substr(index).match(/^[a-z\d]+/i);
        const last = (m ? m[0].length : 0) + index;
        setSelection(first, last);

        // Set tripleclick
        $(evt.target).click(selectAll);
        setTimeout(() => {
            $(evt.target).unbind('click', selectAll);
        }, 300);
    }
    const textActions = {
        /**
      * @param {Element} target
      * @param {Float} x
      * @param {Float} y
      * @returns {void}
      */
        select(target, x, y) {
            curtext = target;
            textActions.toEditMode(x, y);
        },
        /**
      * @param {Element} elem
      * @returns {void}
      */
        start(elem) {
            curtext = elem;
            textActions.toEditMode();
        },
        /**
      * @param {external:MouseEvent} evt
      * @param {Element} mouseTarget
      * @param {Float} startX
      * @param {Float} startY
      * @returns {void}
      */
        mouseDown(evt, mouseTarget, startX, startY) {
            // const pt = screenToPt(startX, startY);
            textinput.focus();
            // setCursorFromPoint(startX, startY);
            lastX = startX;
            lastY = startY;

            // TODO: Find way to block native selection
        },
        /**
      * @param {Float} mouseX
      * @param {Float} mouseY
      * @returns {void}
      */
        mouseMove(mouseX, mouseY) {
            // const pt = screenToPt(mouseX, mouseY);
            setEndSelectionFromPoint(mouseX, mouseY);
        },
        /**
      * @param {external:MouseEvent} evt
      * @param {Float} mouseX
      * @param {Float} mouseY
      * @returns {void}
      */
        mouseUp(evt, mouseX, mouseY) {
            // const pt = screenToPt(mouseX, mouseY);


            // console.log(evt.target, curtext, mouseX, mouseY);
            // TODO: Find a way to make this work: Use transformed BBox instead of evt.target
            // if (lastX === mouseX && lastY === mouseY
            //   && !rectsIntersect(transbb, {x: pt.x, y: pt.y, width: 0, height: 0})) {
            //   textActions.toSelectMode(true);
            // }
            if (
                evt.target !== curtext
          && mouseX < lastX + 2
          && mouseX > lastX - 2
          && mouseY < lastY + 2
          && mouseY > lastY - 2
            ) {
                textActions.toSelectMode(true);
            } else {
                setCursorFromPoint(mouseX, mouseY);
            }
        },
        /**
      * @function
      * @param {Integer} index
      * @returns {void}
      */
        setCursor,
        /**
      * @param {Float} x
      * @param {Float} y
      * @returns {void}
      */
        toEditMode(x, y) {
            allowDbl = false;
            canvas.mode = 'textedit';
            selectorManager.requestSelector(curtext).showGrips(false);
            // Make selector group accept clicks
            /* const selector = */ selectorManager.requestSelector(curtext); // Do we need this? Has side effect of setting lock, so keeping for now, but next line wasn't being used
            // const sel = selector.selectorRect;

            textActions.init();

            $(curtext).css('cursor', 'text');

            // if (supportsEditableText()) {
            //   curtext.setAttribute('editable', 'simple');
            //   return;
            // }

            if (!arguments.length) {
                setCursor();
            } else {
                // const pt = screenToPt(x, y);
                // console.log(x, y, pt);
                setCursorFromPoint(x, y);
            }

            setTimeout(() => {
                allowDbl = true;
            }, 300);
        },
        /**
          * @param {boolean|Element} selectElem
          * @fires module:svgcanvas.SvgCanvas#event:selected
          * @returns {void}
          */
        toSelectMode() {
            canvas.mode = 'select';
            clearInterval(blinker);
            blinker = null;
            if (selblock) { $(selblock).attr('display', 'none'); }
            if (cursor) { $(cursor).attr('visibility', 'hidden'); }
            $(curtext).css('cursor', 'move');
            selectorManager.requestSelector(curtext).showGrips(true);

            // if (curtext && !curtext.textContent.length) {
            //     // No content, so delete
            //     canvas.deleteSelectedElements();
            // }

            $(textinput).blur();

            curtext = false;

            // if (supportsEditableText()) {
            //   curtext.removeAttribute('editable');
            // }
        },
        /**
      * @param {Element} elem
      * @returns {void}
      */
        setInputElem(input) {
            textinput = input;
            $(textinput).bind('keyup input', (e) => {
                const text = e.target.value;
                const svgModel = canvas.props.svgModelGroup.getModelByElement(curtext);
                svgModel.relatedModel.updateAndRefresh({ config: { text } });
                textActions.init();
                textActions.setCursor();
            });

            $(textinput).blur(hideCursor);
        },
        /**
      * @returns {void}
      */
        clear() {
            if (canvas.mode === 'textedit') {
                textActions.toSelectMode();
            }
        },
        /**
      * @param {Element} inputElem Not in use
      * @returns {void}
      */
        init() {
            if (!curtext) { return; }
            let i, end;
            // if (supportsEditableText()) {
            //   curtext.select();
            //   return;
            // }

            // if (!curtext.parentNode) {
            //     // Result of the ffClone, need to get correct element
            //     curtext = selectedElements[0];
            //     selectorManager.requestSelector(curtext).showGrips(false);
            // }

            const str = curtext.textContent;
            const len = str.length;

            const xform = curtext.getAttribute('transform');

            textbb = getBBox(curtext);

            matrix = xform ? getMatrix(curtext) : null;

            chardata = [];
            chardata.length = len;
            textinput.focus();

            $(curtext).unbind('dblclick', selectWord).dblclick(selectWord);

            if (!len) {
                end = { x: textbb.x + (textbb.width / 2), width: 0 };
            }

            for (i = 0; i < len; i++) {
                const start = curtext.getStartPositionOfChar(i);
                end = curtext.getEndPositionOfChar(i);

                // if (!supportsGoodTextCharPos()) {
                //     const offset = canvas.contentW * canvas.scale;
                //     start.x -= offset;
                //     end.x -= offset;

                //     start.x /= canvas.scale;
                //     end.x /= canvas.scale;
                // }

                // Get a "bbox" equivalent for each character. Uses the
                // bbox data of the actual text for y, height purposes

                // TODO: Decide if y, width and height are actually necessary
                chardata[i] = {
                    x: start.x,
                    y: textbb.y, // start.y?
                    width: end.x - start.x,
                    height: textbb.height
                };
            }

            // Add a last bbox for cursor at end of text
            chardata.push({
                x: end.x,
                y: textbb.y, // start.y?
                width: 0,
                height: textbb.height
            });
            setSelection(textinput.selectionStart, textinput.selectionEnd, true);
            $(textinput).val(curtext.textContent);
        }
    };

    // textActions.setInputElem();
    return textActions;
};

export default textActionCreator;
