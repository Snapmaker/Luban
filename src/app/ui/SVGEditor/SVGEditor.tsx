import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { v4 as uuid } from 'uuid';

import { PREDEFINED_SHORTCUT_ACTIONS, ShortcutHandlerPriority, ShortcutManager } from '../../lib/shortcut';
import styles from './styles.styl';
import { SVG_EVENT_CONTEXTMENU } from './constants';
import SVGCanvas from './SVGCanvas';
import SVGLeftBar from './SVGLeftBar';
import { Materials } from '../../constants/coordinate';
import api from '../../api';
import { createSVGElement, setAttributes } from './element-utils';
import canvg from './lib/canvg';


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

    const [menuDisabledCount, setMenuDisabledCount] = useState(props.menuDisabledCount);
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


        // const v = Canvg.fromString(ctx1, svgTag);
        // await v.isReady();
        // console.log(v);
        // await v.render();
        // document.body.appendChild(canvas1);
        // return canvas1;
        return new Promise((resolve) => {
            canvg(canvas1, svgTag, {
                ignoreAnimation: true,
                ignoreMouse: true,
                renderCallback() {
                    console.log('v2 ok');
                    document.body.appendChild(canvas1);
                    resolve(canvas1);
                }
            });
        });
    };
    const handleClipPath = async (svgs, imgs, viewboxX, viewboxY, viewWidth, viewHeight) => {
        // const svgContentGroup = canvas.current.svgContentGroup;
        // const elem = svgContentGroup.addSVGElement({
        //     element: 'clipPath',
        //     curStyles: true,
        // });
        const elem = createSVGElement({
            element: 'clipPath',
            attr: {
                id: `${uuid()}`
            }
        });
        console.log(elem);
        svgs.forEach(svg => elem.append(svg.svgPath));
        imgs.forEach(img => img.elem.setAttribute('clip-path', `url(#${elem.id})`));
        // create new Image
        const clipPathClone = elem.cloneNode(true);
        const imgsClones = imgs.map(img => img.elem.cloneNode(true));
        const clipPathSvgContent = new XMLSerializer().serializeToString(clipPathClone);
        const imgsSvgContent = imgsClones
            .map(imgsClone => new XMLSerializer().serializeToString(imgsClone))
            .map((v, index) => v.replace(/href="(.*?)"/, `href="${imgs[index].resource.originalFile.path}"`))
            .reduce((pre, curr) => pre + curr, '');

        const widthRatio = imgs[0].sourceWidth / imgs[0].width;
        const heightRatio = imgs[0].sourceHeight / imgs[0].height;
        const svgTag = `<svg xmlns="http://www.w3.org/2000/svg" width="${viewWidth * widthRatio}" height="${viewHeight * heightRatio}" viewBox="${viewboxX} ${viewboxY} ${viewWidth} ${viewHeight}">${clipPathSvgContent + imgsSvgContent}</svg>`;
        const canvas1 = await svgToCanvas(svgTag, viewWidth, viewHeight);
        const img = await canvasToImage(canvas1);
        props.onChangeFile({ target: { files: [img] } });
        // console.log(svgTag);
        // const canvas1 = document.createElement('canvas');
        // canvas1.style.width = `${viewWidth}px`;
        // canvas1.style.height = `${viewHeight}px`;
        // canvas1.id = 'test';
        // const ctx1 = canvas1.getContext('2d');
        // canvas1.style.backgroundColor = 'transparent';
        // ctx1.fillStyle = 'transparent';
        // const v = Canvg.fromString(ctx1, svgTag);
        // await v.render();
        // document.body.appendChild(canvas1);
        // const dataUrl = canvas1.toDataURL('image/png');
        // const p = fetch(dataUrl).then(response => response.blob());
        // const b = await p; // (canvas1);
        // const f = new File([b], 'test.png');
        // props.onChangeFile({ target: { files: [f] } });
        // const downloadImage = (data) => {
        //     const link = document.createElement('a');
        //     link.download = 'canvas_image.png';
        //     link.href = URL.createObjectURL(data);
        //     link.click();
        //     URL.revokeObjectURL(link.href);
        // };
        // downloadImage(b);
        // console.log(f);

        return svgTag;
    };
    const handleMask = async (svgs, imgs) => {
        // const svgContentGroup = canvas.current.svgContentGroup;
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
        maskElem.append(rect);
        svgs.forEach(svg => {
            const svgShapeTag = svg.svgPath || svg.elem;
            svgShapeTag.setAttribute('fill', 'black');
            svgShapeTag.setAttribute('fill-opacity', '1');
            maskElem.append(svgShapeTag);
        });
        imgs.forEach(img => img.elem.setAttribute('mask', `url(#${maskElem.id})`));
        const maxminXY = imgs.reduce((pre, curr) => {
            const leftTopX = curr.elem.getAttribute('x') - 0;
            const leftTopY = curr.elem.getAttribute('y') - 0;
            const rightBottomX = leftTopX + curr.width;
            const rightBottomY = leftTopY + curr.height;
            return {
                max: {
                    x: Math.max(pre.max.x, leftTopX, rightBottomX),
                    y: Math.max(pre.max.y, leftTopY, rightBottomY)
                },
                min: {
                    x: Math.min(pre.min.x, leftTopX, rightBottomX),
                    y: Math.min(pre.min.y, leftTopY, rightBottomY)
                }
            };
        }, { max: { x: -Infinity, y: -Infinity }, min: { x: Infinity, y: Infinity } });
        setAttributes(rect, { 'x': maxminXY.min.x, 'y': maxminXY.min.y });
        const viewboxX = maxminXY.min.x;
        const viewboxY = maxminXY.min.y;
        const viewWidth = maxminXY.max.x - maxminXY.min.x;
        const viewHeight = maxminXY.max.y - maxminXY.min.y;
        const maskClone = maskElem.cloneNode(true);
        const imgsClones = imgs.map(img => img.elem.cloneNode(true));
        const maskSvgContent = new XMLSerializer().serializeToString(maskClone);
        const imgsSvgContent = imgsClones
            .map(imgsClone => new XMLSerializer().serializeToString(imgsClone))
            .map((v, index) => v.replace(/href="(.*?)"/, `href="${imgs[index].resource.originalFile.path}"`))
            .reduce((pre, curr) => pre + curr, '');


        const widthRatio = imgs[0].sourceWidth / imgs[0].width;
        const heightRatio = imgs[0].sourceHeight / imgs[0].height;
        const svgTag = `<svg xmlns="http://www.w3.org/2000/svg" width="${viewWidth * widthRatio}" height="${viewHeight * heightRatio}" viewBox="${viewboxX} ${viewboxY} ${viewWidth} ${viewHeight}">${maskSvgContent + imgsSvgContent}</svg>`;
        const canvas1 = await svgToCanvas(svgTag, viewWidth, viewHeight);
        const img = await canvasToImage(canvas1);
        props.onChangeFile({ target: { files: [img] } });
        return svgTag;
    };
    const onClipper = async (imgs, svgs) => {
        console.log(svgs);
        const maxminXY = svgs.reduce((pre, curr) => {
            const leftTopX = curr.elem.getAttribute('x') - 0;
            const leftTopY = curr.elem.getAttribute('y') - 0;
            const rightBottomX = leftTopX + curr.width;
            const rightBottomY = leftTopY + curr.height;
            return {
                max: {
                    x: Math.max(pre.max.x, leftTopX, rightBottomX),
                    y: Math.max(pre.max.y, leftTopY, rightBottomY)
                },
                min: {
                    x: Math.min(pre.min.x, leftTopX, rightBottomX),
                    y: Math.min(pre.min.y, leftTopY, rightBottomY)
                }
            };
        }, { max: { x: -Infinity, y: -Infinity }, min: { x: Infinity, y: Infinity } });
        const viewboxX = maxminXY.min.x;
        const viewboxY = maxminXY.min.y;
        const viewWidth = maxminXY.max.x - maxminXY.min.x;
        const viewHeight = maxminXY.max.y - maxminXY.min.y;

        const clipSvgTag = await handleClipPath(svgs, imgs, viewboxX, viewboxY, viewWidth, viewHeight);
        console.log(clipSvgTag);

        const blob = new Blob([clipSvgTag], { type: 'image/svg+xml' });
        const file = new File([blob], `${'modelID'}.svg`);
        const formData = new FormData();
        formData.append('image', file);
        const res = await api.uploadImage(formData);
        console.log(res);
    };
    const onClipperSvg = async (imgs, svgs) => {
        const maskSvgTag = await handleMask(svgs, imgs);
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
