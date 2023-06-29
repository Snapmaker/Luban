import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { v4 as uuid } from 'uuid';

// import Canvg from 'canvg';
import { useDispatch, useSelector } from 'react-redux';
import { PREDEFINED_SHORTCUT_ACTIONS, ShortcutHandlerPriority, ShortcutManager } from '../../lib/shortcut';
import styles from './styles.styl';
import { SVG_EVENT_CONTEXTMENU } from './constants';
import SVGCanvas from './SVGCanvas';
import SVGLeftBar from './SVGLeftBar';
import { Materials } from '../../constants/coordinate';
import { createSVGElement, setAttributes } from './element-utils';
import canvg from './lib/canvg';
// import { actions as editorActions } from '../../flux/editor';
// import i18n from '../../lib/i18n';
// import modal from '../../lib/modal';
import { HEAD_LASER, PROCESS_MODE_GREYSCALE } from '../../constants';
import { flattenNestedGroups } from './lib/FlattenNestedGroups';


export type SVGEditorHandle = {
    zoomIn: () => void;
    zoomOut: () => void;
    autoFocus: () => void;
}

type SVGEditorProps = {
    isActive: boolean;

    size: object;
    materials: Materials;

    SVGActions: object;
    scale: number;
    minScale: number;
    maxScale: number;
    target: object;
    coordinateMode: object;
    coordinateSize: object;
    origin: object;
    editable: boolean;

    menuDisabledCount: number;
    SVGCanvasMode: string;
    SVGCanvasExt: object;

    updateScale: () => void;
    updateTarget: () => void;

    initContentGroup: () => void;
    onCreateElement: (element) => void;
    onSelectElements: (elements) => void;
    onClearSelection: () => void;
    onMoveSelectedElementsByKey: () => void;
    createText: (text) => void;
    updateTextTransformationAfterEdit: (element, transformation) => void;
    getSelectedElementsUniformScalingState: () => void;

    elementActions: {
        moveElementsStart: (elements, options?) => void;
        moveElements: (elements, options) => void;
        moveElementsFinish: (elements, options) => void;
        resizeElementsStart: (elements, options) => void;
        resizeElements: (elements, options) => void;
        resizeElementsFinish: (elements, options) => void;
        rotateElementsStart: (elements, options) => void;
        rotateElements: (elements, options) => void;
        rotateElementsFinish: (elements, options) => void;
        moveElementsOnKeyDown: (elements, options) => void;
        isPointInSelectArea: (elements, options) => void;
        getMouseTargetByCoordinate: (elements, options) => void;
        isSelectedAllVisible: (elements, options) => void;
    };

    showContextMenu: (event) => void;

    editorActions: {
        undo: () => void;
        redo: () => void;
        selectAll: () => void;
    }
};

const SVGEditor = forwardRef<SVGEditorHandle, SVGEditorProps>((props, ref) => {
    const canvas = useRef(null);
    const leftBarRef = useRef(null);
    const extRef = useRef(props.SVGCanvasExt);
    extRef.current = props.SVGCanvasExt;
    const dispatch = useDispatch();

    const [menuDisabledCount, setMenuDisabledCount] = useState(props.menuDisabledCount);
    const selectedModelArray = useSelector(state => state[props.headType]?.modelGroup?.selectedModelArray);
    useEffect(() => {
        setMenuDisabledCount(props.menuDisabledCount);
    }, [props.menuDisabledCount]);

    const menuDisabledCountRef = useRef(menuDisabledCount);
    menuDisabledCountRef.current = menuDisabledCount;

    const onStopDraw = (exitCompletely, nextMode) => {
        return canvas.current.stopDraw(exitCompletely, nextMode);
    };

    useEffect(() => {
        const moveElements = (config) => {
            const selectedElements = props.elementActions.isSelectedAllVisible();
            if (selectedElements) {
                props.elementActions.moveElementsStart(selectedElements);
                props.elementActions.moveElements(selectedElements, config);
            }
        };

        const moveElementsFinish = () => {
            const selectedElements = props.elementActions.isSelectedAllVisible();
            selectedElements && props.elementActions.moveElementsFinish(selectedElements);
        };

        const shortcutHandler = {
            title: 'SVGEditor',
            // TODO: unregister in case of component is destroyed
            isActive: () => props.isActive,
            priority: ShortcutHandlerPriority.View,
            shortcuts: {
                [PREDEFINED_SHORTCUT_ACTIONS.UNDO]: () => {
                    if (!(menuDisabledCountRef.current > 0)) {
                        props.editorActions.undo();
                    }
                },
                [PREDEFINED_SHORTCUT_ACTIONS.REDO]: () => {
                    if (!(menuDisabledCountRef.current > 0)) {
                        props.editorActions.redo();
                    }
                },
                [PREDEFINED_SHORTCUT_ACTIONS.SELECTALL]: () => {
                    if (!(menuDisabledCountRef.current > 0)) {
                        props.editorActions.selectAll();
                    }
                },
                [PREDEFINED_SHORTCUT_ACTIONS.UNSELECT]: () => {
                    if (!(menuDisabledCountRef.current > 0)) {
                        props.editorActions.unselectAll();
                    }
                },
                [PREDEFINED_SHORTCUT_ACTIONS.DELETE]: () => {
                    if (!(menuDisabledCountRef.current > 0)) {
                        props.editorActions.deleteSelectedModel(extRef.current.elem ? 'draw' : props.SVGCanvasMode);
                    }
                },
                [PREDEFINED_SHORTCUT_ACTIONS.COPY]: () => {
                    if (!(menuDisabledCountRef.current > 0)) {
                        props.editorActions.copy();
                    }
                },
                [PREDEFINED_SHORTCUT_ACTIONS.PASTE]: () => {
                    if (!(menuDisabledCountRef.current > 0)) {
                        props.editorActions.paste();
                    }
                },
                [PREDEFINED_SHORTCUT_ACTIONS.DUPLICATE]: () => {
                    if (!(menuDisabledCountRef.current > 0)) {
                        props.editorActions.duplicateSelectedModel();
                    }
                },
                [PREDEFINED_SHORTCUT_ACTIONS.CUT]: () => {
                    if (!(menuDisabledCountRef.current > 0)) {
                        props.editorActions.cut();
                    }
                },
                [PREDEFINED_SHORTCUT_ACTIONS.ENTER]: () => {
                    if (!(menuDisabledCountRef.current > 0)) {
                        onStopDraw(true);
                    }
                },
                // optimize: accelerate when continuous click
                'MOVE-UP': {
                    keys: ['up'],
                    callback: () => {
                        moveElements({ dx: 0, dy: -1 });
                    },
                    keyupCallback: () => {
                        moveElementsFinish();
                    }
                },
                'MOVE-DOWM': {
                    keys: ['down'],
                    callback: () => {
                        moveElements({ dx: 0, dy: 1 });
                    },
                    keyupCallback: () => {
                        moveElementsFinish();
                    }
                },
                'MOVE-LEFT': {
                    keys: ['left'],
                    callback: () => {
                        moveElements({ dx: -1, dy: 0 });
                    },
                    keyupCallback: () => {
                        moveElementsFinish();
                    }
                },
                'MOVE-RIGHT': {
                    keys: ['right'],
                    callback: () => {
                        moveElements({ dx: 1, dy: 0 });
                    },
                    keyupCallback: () => {
                        moveElementsFinish();
                    }
                }

            }
        };
        ShortcutManager.register(shortcutHandler);

        return () => {
            ShortcutManager.unregister(shortcutHandler);
        };
    }, [
        props.elementActions,
        props.editorActions,
        props.SVGCanvasMode,
        props.isActive,
    ]);

    const changeCanvasMode = (_mode, ext) => {
        props.editorActions.setMode(_mode, ext);
    };

    useEffect(() => {
        // canvas.current.on(SVG_EVENT_MODE, (_mode) => {
        //     changeCanvasMode(_mode);
        // });

        canvas.current.on(SVG_EVENT_CONTEXTMENU, (event) => {
            props.showContextMenu(event);
        });

        // Init, Setup SVGContentGroup
        props.initContentGroup(canvas.current.svgContentGroup);
    }, []);

    const insertDefaultTextVector = async () => {
        const element = await props.createText('Snapmaker');
        props.onCreateElement(element);

        // todo, select text after create
        // canvas.current.selectOnly([elem]);
        changeCanvasMode('select');
    };

    const hideLeftBarOverlay = () => {
        leftBarRef.current.actions.hideLeftBarOverlay();
    };

    const zoomIn = () => {
        canvas.current.zoomIn();
    };

    const zoomOut = () => {
        canvas.current.zoomOut();
    };

    const autoFocus = () => {
        canvas.current.autoFocus();
    };

    useImperativeHandle(ref, () => ({
        zoomIn,
        zoomOut,
        autoFocus,
    }));

    const onStartDraw = () => {
        canvas.current.startDraw();
    };


    const onDrawTransformComplete = (...args) => {
        props.editorActions.onDrawTransformComplete(...args);
    };

    const parseTransform = (transformAttr) => {
        const transformValues = [];
        const regex = /(\w+)\(([^)]+)\)/g;
        let match = regex.exec(transformAttr);

        while (match !== null) {
            const transformType = match[1];
            const transformParams = match[2].split(/[\s,]+/).map(parseFloat);

            transformValues.push({
                type: transformType,
                params: transformParams
            });
            // next
            match = regex.exec(transformAttr);
        }

        return transformValues;
    };
    const isShapeSvg = (svg) => {
        console.log('isShapeSvg', svg, svg.tagName);
        if (!svg || !svg.tagName) return false;
        switch (svg.tagName) {
            case 'rect':
            case 'circle':
            case 'line':
            case 'polyline':
            case 'polygon':
            case 'path':
            case 'text':
            case 'image':
            case 'ellipse':
                // case 'g':
                // case 'use':
                // case 'foreignObject':
                return true;
            default:
                return false;
        }
    };
    const canvasToImage = async (canvas1) => {
        document.body.appendChild(canvas1);
        const dataUrl = canvas1.toDataURL('image/png');
        const p = fetch(dataUrl).then(async response => response.blob());
        const b = await p; // (canvas1);
        const f = new File([b], 'test.png');
        const downloadImage = (data) => {
            const link = document.createElement('a');
            link.download = 'canvas_image.png';
            link.href = URL.createObjectURL(data);
            link.click();
            URL.revokeObjectURL(link.href);
        };
        downloadImage(b);
        return f;
    };
    const svgToCanvas = async (svgTag, width, height) => {
        console.log(svgTag);
        const canvas1 = document.createElement('canvas');
        const ctx1 = canvas1.getContext('2d');
        canvas1.style.width = `${width}px`;
        canvas1.style.height = `${height}px`;
        canvas1.id = uuid();
        canvas1.style.backgroundColor = 'transparent';
        ctx1.fillStyle = 'transparent';

        return new Promise((resolve) => {
            canvg(canvas1, svgTag, {
                ignoreAnimation: true,
                ignoreMouse: true,
                renderCallback() {
                    resolve(canvas1);
                }
            });
        });
    };
    const calculateElemsBoundingbox = (elems) => {
        // calculate viewbox value (boundingbox)
        const maxminXY = elems.reduce((pre, curr) => {
            const rotationAngleRad = curr.angle * (Math.PI / 180) || 0;
            const bbox = curr.elem.getBBox();
            const centerX = bbox.x + bbox.width / 2;
            const centerY = bbox.y + bbox.height / 2;

            // 计算旋转后的四个顶点坐标
            const topLeftX = centerX + (bbox.x - centerX) * Math.cos(rotationAngleRad) - (bbox.y - centerY) * Math.sin(rotationAngleRad);
            const topLeftY = centerY + (bbox.x - centerX) * Math.sin(rotationAngleRad) + (bbox.y - centerY) * Math.cos(rotationAngleRad);

            const topRightX = centerX + (bbox.x + bbox.width - centerX) * Math.cos(rotationAngleRad) - (bbox.y - centerY) * Math.sin(rotationAngleRad);
            const topRightY = centerY + (bbox.x + bbox.width - centerX) * Math.sin(rotationAngleRad) + (bbox.y - centerY) * Math.cos(rotationAngleRad);

            const bottomLeftX = centerX + (bbox.x - centerX) * Math.cos(rotationAngleRad) - (bbox.y + bbox.height - centerY) * Math.sin(rotationAngleRad);
            const bottomLeftY = centerY + (bbox.x - centerX) * Math.sin(rotationAngleRad) + (bbox.y + bbox.height - centerY) * Math.cos(rotationAngleRad);

            const bottomRightX = centerX + (bbox.x + bbox.width - centerX) * Math.cos(rotationAngleRad) - (bbox.y + bbox.height - centerY) * Math.sin(rotationAngleRad);
            const bottomRightY = centerY + (bbox.x + bbox.width - centerX) * Math.sin(rotationAngleRad) + (bbox.y + bbox.height - centerY) * Math.cos(rotationAngleRad);
            const minX = Math.min(pre.min.x, topLeftX, topRightX, bottomLeftX, bottomRightX);
            const minY = Math.min(pre.min.y, topLeftY, topRightY, bottomLeftY, bottomRightY);
            const maxX = Math.max(pre.max.x, topLeftX, topRightX, bottomLeftX, bottomRightX);
            const maxY = Math.max(pre.max.y, topLeftY, topRightY, bottomLeftY, bottomRightY);
            // const newWidth = maxX - minX;
            // const newHeight = maxY - minY;
            console.log('bbox', bbox, topLeftX, topRightX, bottomLeftX, bottomRightX, topLeftY, topRightY, bottomLeftY, bottomRightY, minX, minY, maxX, maxY);
            return {
                max: { x: maxX, y: maxY },
                min: { x: minX, y: minY }
            };
            // const leftTopX = parseFloat(curr.elem.getAttribute('x')) ;
            // const leftTopY = parseFloat(curr.elem.getAttribute('y')) ;
            // const rightBottomX = leftTopX + curr.width;
            // const rightBottomY = leftTopY + curr.height;
            // console.log('bounding box', curr.elem.getBBox());
            // console.log('bounding box', leftTopX, leftTopY, rightBottomX, rightBottomY);
            // return {
            //     max: {
            //         x: Math.max(pre.max.x, leftTopX, rightBottomX),
            //         y: Math.max(pre.max.y, leftTopY, rightBottomY)
            //     },
            //     min: {
            //         x: Math.min(pre.min.x, leftTopX, rightBottomX),
            //         y: Math.min(pre.min.y, leftTopY, rightBottomY)
            //     }
            // };
        }, { max: { x: -Infinity, y: -Infinity }, min: { x: Infinity, y: Infinity } });
        const viewboxX = maxminXY.min.x;
        const viewboxY = maxminXY.min.y;
        const viewWidth = maxminXY.max.x - maxminXY.min.x;
        const viewHeight = maxminXY.max.y - maxminXY.min.y;
        return { viewboxX, viewboxY, viewWidth, viewHeight };
    };
    const rotatePath = (elem, angle) => {
        if (!isShapeSvg(elem)) return;
        // Helper function for creating a rotation transformation matrix
        function createRotationMatrix(cx, cy, radianAngle) {
            const cos = Math.cos(radianAngle);
            const sin = Math.sin(radianAngle);
            const matrix = elem.ownerSVGElement.createSVGMatrix();
            matrix.a = cos;
            matrix.b = sin;
            matrix.c = -sin;
            matrix.d = cos;
            matrix.e = (1 - cos) * cx + sin * cy;
            matrix.f = -sin * cx + (1 - cos) * cy;
            return matrix;
        }

        // Get the current transformation matrix of the path element
        const currentMatrix = elem.transform && elem.transform.baseVal.consolidate().matrix;

        // Calculate the center coordinates of the path element
        const bbox = elem.getBBox();
        const centerX = bbox.x + bbox.width / 2;
        const centerY = bbox.y + bbox.height / 2;

        // Create a rotation transformation matrix
        const rotationMatrix = createRotationMatrix(centerX, centerY, angle * Math.PI / 180);

        // Multiply the rotation transformation matrix with the current transformation matrix
        const newMatrix = currentMatrix.multiply(rotationMatrix);

        // Apply the new transformation matrix to the path element's transform attribute
        elem.transform.baseVal.initialize(elem.ownerSVGElement.createSVGTransformFromMatrix(newMatrix));
    };
    const createSvg = (svgString, svg, viewWidth, viewHeight) => {
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
        const svgElement = svgDoc.documentElement;
        flattenNestedGroups(svgElement);
        const [originalViewX, originalViewY, originalViewWidth, originalViewHeight] = svgElement.getAttribute('viewBox').split(' ').map(parseFloat);
        viewWidth = viewWidth || originalViewWidth;
        viewHeight = viewHeight || originalViewHeight;

        console.log('', new XMLSerializer().serializeToString(svgElement));
        const attributes = {};
        const scaleWidth = svg.elem.getAttribute('width') ? svg.elem.getAttribute('width') * 935 / 240 / originalViewWidth : viewWidth / originalViewWidth;
        const scaleHeight = svg.elem.getAttribute('width') ? svg.elem.getAttribute('width') * 935 / 240 / originalViewWidth : viewHeight / originalViewHeight;
        const x = parseFloat(svg.elem.getAttribute('x')) * 935 / 240;
        const y = parseFloat(svg.elem.getAttribute('y')) * 935 / 240;
        const svgTransforms = parseTransform(svg.elem.getAttribute('transform'));
        const svgRotate = svgTransforms.find(attr => attr.type === 'rotate');

        const children = Array.from(svgElement.children);
        document.body.appendChild(svgElement);
        const combineTranslate = (translateValue = 0, originalViewBoxValue = 0, svgScaleValue = 1, currXorYValue = 0) => {
            return (translateValue - originalViewBoxValue) * svgScaleValue + currXorYValue;
        };
        for (let i = 0; i < children.length; i++) {
            const curr = children[i];
            const transformAttrs = parseTransform(curr.getAttribute('transform'));
            // TODO: handle have multi same transforms like "translate(10, 10) rotate(45) translate(20, 20)"
            const translate = transformAttrs.find(attr => attr.type === 'translate');
            const scale = transformAttrs.find(attr => attr.type === 'scale');
            const rotate = transformAttrs.find(attr => attr.type === 'rotate');
            const skewX = transformAttrs.find(attr => attr.type === 'skewX');
            const skewY = transformAttrs.find(attr => attr.type === 'skewY');

            // caculate tag finally transform
            const currX = combineTranslate(translate && translate.params[0], originalViewX, scaleWidth, x);
            const currY = combineTranslate(translate && translate.params[1], originalViewY, scaleHeight, y);
            const currScaleWidth = scale ? scale.params[0] * scaleWidth : scaleWidth;
            const currScaleHeight = scale ? scale.params[1] * scaleWidth : scaleHeight;
            const currRotate = rotate && rotate.params[0] || 0;
            const currSkewX = skewX && skewX.params[0] || 0;
            const currSkewY = skewY && skewY.params[0] || 0;
            attributes.transform = `translate(${currX} ${currY}) scale(${currScaleWidth} ${currScaleHeight}) rotate(${currRotate}) skewX(${currSkewX}) skewY(${currSkewY})`;
            setAttributes(curr, attributes);

            // apply image(from luban fontend canvas) rotate to tag
            // Because they are different coordinate systems, the rotate value on the tag cannot be directly added.
            const rootRotateValue = currScaleWidth > 0 && currScaleHeight > 0 ? (svgRotate.params[0] || 0) : -(svgRotate.params[0] || 0);
            rotatePath(curr, rootRotateValue);
        }
        document.body.removeChild(svgElement);
        return children;
    };
    const getSvgString = async (svg, viewWidth, viewHeight) => {
        // if (svg.svgPath) return [svg.svgPath];
        const url = svg.resource.originalFile.path;
        return fetch(`http://localhost:8080${url}`)
            .then(async response => response.text())
            .then(svgString => {
                console.log('svgString=====================', svgString);
                return createSvg(svgString, svg, viewWidth, viewHeight);
            })
            .catch(error => {
                // 处理错误
                console.error('Error:', error);
            });
    };
    const createSvgStr = (wrapperElem, othersElem, imgsSvgModel, viewboxX, viewboxY, viewWidth, viewHeight, gElem) => {
        const widthRatio = imgsSvgModel[0].sourceWidth / imgsSvgModel[0].width;
        const heightRatio = imgsSvgModel[0].sourceHeight / imgsSvgModel[0].height;

        const wrapperClone = wrapperElem.cloneNode(true);
        const imgsClones = [];
        imgsSvgModel
            .forEach(img => {
                const cloneImgElem = img.elem.cloneNode(true);
                imgsClones.push(cloneImgElem);

                // img's position(left-top) and dimensions, before the img scale
                const originalX = parseFloat(cloneImgElem.getAttribute('x'));
                const originalY = parseFloat(cloneImgElem.getAttribute('y'));
                const originalWidth = parseFloat(cloneImgElem.getAttribute('width'));
                const originalHeight = parseFloat(cloneImgElem.getAttribute('height'));
                const originalTransform = cloneImgElem.getAttribute('transform');

                // img's position(left-top) and dimensions and center position, before the img scale
                const transformedX = originalX * widthRatio;
                const transformedY = originalY * heightRatio;
                const transformedWidth = originalWidth * widthRatio;
                const transformedHeight = originalHeight * heightRatio;
                const transformXCenter = transformedX + transformedWidth / 2;
                const transformYCenter = transformedY + transformedHeight / 2;

                // scale image for keeping img dimensions of pixel.
                cloneImgElem.setAttribute('x', transformedX);
                cloneImgElem.setAttribute('y', transformedY);
                cloneImgElem.setAttribute('width', transformedWidth);
                cloneImgElem.setAttribute('height', transformedHeight);

                // because we will scale img for keeping img dimensions of pixel.
                // so we need to handle img rotate after img scaled.
                // here we remove rotate first and add a rotate, which center is the center after img scale
                cloneImgElem.setAttribute('transform', `${originalTransform.replace(/rotate\((.*?)\)/ig, '')} rotate(${img.angle}, ${transformXCenter} ${transformYCenter})`);
            });

        const wrapperSvgContent = new XMLSerializer().serializeToString(wrapperClone);
        const imgsSvgContent = imgsClones
            .map(imgsClone => new XMLSerializer().serializeToString(imgsClone))
            .map((v, index) => v.replace(/href="(.*?)"/, `href="${imgsSvgModel[index].resource.originalFile.path}"`))
            .reduce((pre, curr) => pre + curr, '');
        const otherSvgsContent = othersElem.map(el => new XMLSerializer().serializeToString(el)).reduce((pre, curr) => pre + curr, '');

        let gSvgContent = '';
        if (gElem) {
            gSvgContent = new XMLSerializer().serializeToString(gElem);
        }

        const svgTag = `<svg xmlns="http://www.w3.org/2000/svg" width="${viewWidth}" height="${viewHeight}" viewBox="${viewboxX} ${viewboxY} ${viewWidth} ${viewHeight}">
            ${wrapperSvgContent + gSvgContent + imgsSvgContent + otherSvgsContent}
            </svg>
            `;
        return svgTag;
    };
    const handleClipPath = async (svgs, imgs) => {
        let { viewboxX, viewboxY, viewWidth, viewHeight } = calculateElemsBoundingbox(svgs);
        const widthRatio = imgs[0].sourceWidth / imgs[0].width;
        const heightRatio = imgs[0].sourceHeight / imgs[0].height;
        viewboxX *= widthRatio;
        viewboxY *= heightRatio;
        viewWidth *= widthRatio;
        viewHeight *= heightRatio;

        const elem = createSVGElement({
            element: 'clipPath',
            attr: {
                id: `${uuid()}`
            }
        });
        const gElem = createSVGElement({
            element: 'g',
            attr: {
                id: `${uuid()}`
            }
        });
        const othersElem = [];
        console.log(elem);
        // svgs.forEach(svg => elem.append(svg.svgPath));
        for (let i = 0; i < svgs.length; i++) {
            const svgShapeTags = await getSvgString(svgs[i], viewWidth, viewHeight);
            svgShapeTags.forEach(svgShapeTag => {
                !svgShapeTag.hasAttribute('fill') && svgShapeTag.setAttribute('fill', 'black');
                !svgShapeTag.hasAttribute('fill-opacity') && svgShapeTag.setAttribute('fill-opacity', '0');
                if (isShapeSvg(svgShapeTag)) {
                    elem.append(svgShapeTag);
                    svgShapeTag.setAttribute('fill-opacity', '1');
                    gElem.append(svgShapeTag.cloneNode(true));
                } else {
                    othersElem.push(svgShapeTag);
                }
            });
            // elem.append(...svgShapeTags);
        }
        imgs.forEach(img => {
            img.elem.removeAttribute('mask');
            img.elem.setAttribute('clip-path', `url(#${elem.id})`);
        });
        // create new Image
        const svgTag = createSvgStr(elem, othersElem, imgs, viewboxX, viewboxY, viewWidth, viewHeight, gElem);

        const canvas1 = await svgToCanvas(svgTag, viewWidth, viewHeight);
        const img = await canvasToImage(canvas1);
        await props.onChangeFile({ target: { files: [img] } });
        console.log(selectedModelArray);


        // const mode = PROCESS_MODE_GREYSCALE;
        // const blob = new Blob([svgTag], { type: 'image/svg+xml' });
        // const file = new File([blob], `${elem.id}.svg`);
        // dispatch(editorActions.uploadImage(HEAD_LASER, file, mode, () => {
        //     modal({
        //         cancelTitle: i18n._('key-Laser/Page-Close'),
        //         title: i18n._('key-Laser/Page-Import Error'),
        //         body: i18n._('Failed to import this object. \nPlease select a supported file format.')
        //     });
        // }));
        return svgTag;
    };
    const handleMask = async (svgs, imgs) => {
        let { viewboxX, viewboxY, viewWidth, viewHeight } = calculateElemsBoundingbox(imgs);
        const widthRatio = imgs[0].sourceWidth / imgs[0].width;
        const heightRatio = imgs[0].sourceHeight / imgs[0].height;
        viewboxX *= widthRatio;
        viewboxY *= heightRatio;
        viewWidth *= widthRatio;
        viewHeight *= heightRatio;

        // create svg
        const maskElem = createSVGElement({
            element: 'mask',
            attr: {
                id: `${uuid()}`
            }
        });
        const rect = createSVGElement({
            element: 'rect',
            attr: {
                width: '100%',
                height: '100%',
                fill: 'white',
                'fill-opacity': 1,
            }
        });
        const othersElem = [];
        setAttributes(rect, { 'x': viewboxX, 'y': viewboxY });
        maskElem.append(rect);
        for (let i = 0; i < svgs.length; i++) {
            const svgShapeTags = await getSvgString(svgs[i], viewWidth, viewHeight);
            console.log('svgShapeTags', svgShapeTags);
            svgShapeTags.forEach(svgShapeTag => {
                console.log('svgShapeTag', svgShapeTag);
                // !svgShapeTag.hasAttribute('fill') &&
                svgShapeTag.setAttribute('fill', 'black');
                !svgShapeTag.hasAttribute('fill-opacity') && svgShapeTag.setAttribute('fill-opacity', '1');
                if (isShapeSvg(svgShapeTag)) {
                    maskElem.append(svgShapeTag);
                } else {
                    othersElem.push(svgShapeTag);
                }
            });
        }
        imgs.forEach(img => {
            img.elem.removeAttribute('clip-path');
            img.elem.setAttribute('mask', `url(#${maskElem.id})`);
        });

        const svgTag = createSvgStr(maskElem, othersElem, imgs, viewboxX, viewboxY, viewWidth, viewHeight);
        const canvas1 = await svgToCanvas(svgTag, viewWidth, viewHeight);
        const img = await canvasToImage(canvas1);
        props.onChangeFile({ target: { files: [img] } });
        console.log(canvasToImage, svgToCanvas);

        // const mode = PROCESS_MODE_GREYSCALE;
        // const blob = new Blob([svgTag], { type: 'image/svg+xml' });
        // const file = new File([blob], `${maskElem.id}.svg`);
        // dispatch(editorActions.uploadImage(HEAD_LASER, file, mode, () => {
        //     modal({
        //         cancelTitle: i18n._('key-Laser/Page-Close'),
        //         title: i18n._('key-Laser/Page-Import Error'),
        //         body: i18n._('Failed to import this object. \nPlease select a supported file format.')
        //     });
        // }));
        return svgTag;
    };
    const onClipper = async (imgs, svgs) => {
        const clipSvgTag = await handleClipPath(svgs, imgs);
        console.log(clipSvgTag);
    };
    const onClipperSvg = async (imgs, svgs) => {
        const maskSvgTag = await handleMask(svgs, imgs);
        console.log(HEAD_LASER, PROCESS_MODE_GREYSCALE, dispatch);
        console.log('maskSvgTag', maskSvgTag);
    };

    return (
        <React.Fragment>
            <div className={styles['laser-table']} style={{ position: 'relative' }}>
                <div className={styles['laser-table-row']}>
                    <div className={styles['view-space']}>
                        <SVGCanvas
                            mode={props.SVGCanvasMode}
                            ext={props.SVGCanvasExt}
                            className={styles['svg-content']}
                            editable={props.editable}
                            SVGActions={props.SVGActions}
                            size={props.size}
                            materials={props.materials}
                            scale={props.scale}
                            minScale={props.minScale}
                            maxScale={props.maxScale}
                            target={props.target}
                            updateScale={props.updateScale}
                            updateTarget={props.updateTarget}
                            coordinateMode={props.coordinateMode}
                            coordinateSize={props.coordinateSize}
                            origin={props.origin}
                            ref={canvas}
                            onCreateElement={props.onCreateElement}
                            onSelectElements={props.onSelectElements}
                            onClearSelection={props.onClearSelection}
                            onMoveSelectedElementsByKey={props.onMoveSelectedElementsByKey}
                            updateTextTransformationAfterEdit={props.updateTextTransformationAfterEdit}
                            getSelectedElementsUniformScalingState={props.getSelectedElementsUniformScalingState}
                            elementActions={props.elementActions}
                            hideLeftBarOverlay={hideLeftBarOverlay}
                            onDrawLine={props.editorActions.onDrawLine}
                            onDrawDelete={props.editorActions.onDrawDelete}
                            onDrawTransform={props.editorActions.onDrawTransform}
                            onDrawTransformComplete={(...args) => onDrawTransformComplete(...args)}
                            onDrawStart={props.editorActions.onDrawStart}
                            onDrawComplete={props.editorActions.onDrawComplete}
                            onBoxSelect={props.editorActions.onBoxSelect}
                            setMode={changeCanvasMode}
                        />
                    </div>
                    <SVGLeftBar
                        ref={leftBarRef}
                        mode={props.SVGCanvasMode}
                        selectEditing={!!props.SVGCanvasExt.elem}
                        insertDefaultTextVector={insertDefaultTextVector}
                        setMode={changeCanvasMode}
                        onChangeFile={props.onChangeFile}
                        onClickToUpload={props.onClickToUpload}
                        onClipper={onClipper}
                        onClipperSvg={onClipperSvg}
                        fileInput={props.fileInput}
                        allowedFiles={props.allowedFiles}
                        editable={props.editable}
                        headType={props.headType}
                        onStartDraw={() => onStartDraw()}
                        onStopDraw={(exitCompletely, nextMode) => onStopDraw(exitCompletely, nextMode)}
                    />
                </div>
            </div>
        </React.Fragment>
    );
});

SVGEditor.propTypes = {
    isActive: PropTypes.bool,
    size: PropTypes.object.isRequired,
    SVGActions: PropTypes.object.isRequired,
    scale: PropTypes.number.isRequired,
    minScale: PropTypes.number,
    maxScale: PropTypes.number,
    target: PropTypes.object,
    coordinateMode: PropTypes.object.isRequired,
    coordinateSize: PropTypes.object.isRequired,
    origin: PropTypes.object.isRequired,
    editable: PropTypes.bool,
    menuDisabledCount: PropTypes.number,
    SVGCanvasMode: PropTypes.string.isRequired,
    SVGCanvasExt: PropTypes.object,

    updateScale: PropTypes.func.isRequired,
    updateTarget: PropTypes.func.isRequired,

    initContentGroup: PropTypes.func.isRequired,
    showContextMenu: PropTypes.func,

    // insertDefaultTextVector: PropTypes.func.isRequired

    // editor actions
    onCreateElement: PropTypes.func.isRequired,
    onSelectElements: PropTypes.func.isRequired,
    onClearSelection: PropTypes.func.isRequired,
    onMoveSelectedElementsByKey: PropTypes.func.isRequired,
    updateTextTransformationAfterEdit: PropTypes.func.isRequired,
    getSelectedElementsUniformScalingState: PropTypes.func.isRequired,

    editorActions: PropTypes.object.isRequired,

    createText: PropTypes.func.isRequired,

    onChangeFile: PropTypes.func.isRequired,
    onClickToUpload: PropTypes.func.isRequired,
    fileInput: PropTypes.object.isRequired,
    allowedFiles: PropTypes.string.isRequired,
    headType: PropTypes.string,
};

export default SVGEditor;
