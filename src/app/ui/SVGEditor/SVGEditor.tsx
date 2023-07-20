import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import PropTypes from 'prop-types';

import { PREDEFINED_SHORTCUT_ACTIONS, ShortcutHandlerPriority, ShortcutManager } from '../../lib/shortcut';
import styles from './styles.styl';
import { SVG_EVENT_CONTEXTMENU } from './constants';
import SVGCanvas from './SVGCanvas';
import SVGLeftBar from './SVGLeftBar';
import { Materials } from '../../constants/coordinate';


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
    onChangeFile: (event: MouseEvent) => void;

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
