import classNames from 'classnames';
import isEqual from 'lodash/isEqual';
import noop from 'lodash/noop';
import PropTypes from 'prop-types';
import React from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router-dom';
import * as THREE from 'three';

import path from 'path';
import {
    DISPLAYED_TYPE_TOOLPATH, HEAD_CNC, MAX_LASER_CNC_CANVAS_SCALE, MIN_LASER_CNC_CANVAS_SCALE,
    PAGE_EDITOR,
    SELECTEVENT, VISUALIZER_CAMERA_HEIGHT
} from '../../../constants';
import { Origin, Workpiece, convertMaterialsToWorkpiece } from '../../../constants/coordinate';
import { actions as editorActions } from '../../../flux/editor';
import { actions as machineActions } from '../../../flux/machine';
import { actions as operationHistoryActions } from '../../../flux/operation-history';
import { controller } from '../../../communication/socket-communication';
import i18n from '../../../lib/i18n';
import { STEP_STAGE } from '../../../lib/manager/ProgressManager';
import modal from '../../../lib/modal';
import { humanReadableTime } from '../../../lib/time-utils';
import UniApi from '../../../lib/uni-api';
import { getUploadModeByFilename } from '../../../lib/units';
import ModelGroup from '../../../models/ModelGroup';
import SVGEditor from '../../SVGEditor';
import { Button } from '../../components/Buttons';
import ContextMenu from '../../components/ContextMenu';
import Modal from '../../components/Modal';
import ProgressBar from '../../components/ProgressBar';
import Canvas from '../../components/SMCanvas';
import Space from '../../components/Space';
import { repairModelPopup } from '../../views/repair-model/repair-model-popup';
import PrintablePlate from '../CncLaserShared/PrintablePlate';
import VisualizerBottomLeft from '../CncLaserShared/VisualizerBottomLeft';
import VisualizerTopRight from '../CncLaserTopRight/VisualizerTopRight';
import styles from './styles.styl';


interface VisualizerProps {
    series: string;
    pathname: string;
    page: string;

    materials: object;
    workpiece: Workpiece;
    origin: Origin;

    stage: number;
    progress: number;
    showSimulation: boolean;

    coordinateMode: object;
    coordinateSize: object;
    size: object;
    scale: number;
    target: object;

    menuDisabledCount: number;
    // model: PropTypes.object,
    // selectedModelID: PropTypes.string,
    isChangedAfterGcodeGenerating: boolean;
    selectedModelArray: object[];
    selectedToolPathModels: object[],
    modelGroup: ModelGroup;
    SVGActions: object;
    toolPathGroup: object;
    displayedType: string;
    promptTasks: object[];

    renderingTimestamp: number;
    enableShortcut: boolean;
    isOverSize: boolean;
    SVGCanvasMode: string;
    SVGCanvasExt: object;
    // func
    selectAllElements: () => void;
    cut: () => void;
    copy: () => void;
    paste: () => void;
    clearOperationHistory: () => void;
    undo: () => void;
    redo: () => void;
    initContentGroup: () => void;
    updateTarget: () => void;
    updateScale: () => void;
    scaleCanvasToFit: () => void;

    getEstimatedTime: () => number;
    // getSelectedModel: PropTypes.func.isRequired,
    bringSelectedModelToFront: () => void;
    sendSelectedModelToBack: () => void;
    arrangeAllModels2D: () => void;
    insertDefaultTextVector: () => void;

    onSetSelectedModelPosition: () => void;
    onFlipSelectedModel: () => void;
    selectModelInProcess: () => void;
    removeSelectedModelsByCallback: () => void;
    duplicateSelectedModel: () => void;
    // onModelTransform: PropTypes.func.isRequired,
    // onModelAfterTransform: PropTypes.func.isRequired,

    // editor actions
    onCreateElement: (element) => void;
    onSelectElements: (elements) => void;
    onClearSelection: () => void;
    onMoveSelectedElementsByKey: () => void;
    createText: (text) => void;
    updateTextTransformationAfterEdit: (element, transformation) => void;
    getSelectedElementsUniformScalingState: () => void;
    checkIsOversizeImage: (file, onFailure) => void;
    uploadImage: (file, mode, onFailure, isLimit?, fileInfo?) => void;
    switchToPage: (page) => void;
    updatePromptDamageModel: () => void;
    repairSelectedModels: () => void;

    progressStatesManager: object;

    elementActions: {
        moveElementsStart: (elements, options) => void;
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

    onDrawLine: (line, closedLoop) => void;
    onDrawDelete: () => void;
}

class Visualizer extends React.Component<VisualizerProps> {
    public static propTypes = {
        ...withRouter.propTypes,
        series: PropTypes.string.isRequired,
        pathname: PropTypes.string,
        page: PropTypes.string.isRequired,
        materials: PropTypes.object,
        stage: PropTypes.number.isRequired,
        progress: PropTypes.number.isRequired,
        showSimulation: PropTypes.bool.isRequired,

        coordinateMode: PropTypes.object.isRequired,
        coordinateSize: PropTypes.object.isRequired,
        size: PropTypes.object.isRequired,
        scale: PropTypes.number,
        target: PropTypes.object,
        menuDisabledCount: PropTypes.number,
        // model: PropTypes.object,
        // selectedModelID: PropTypes.string,
        isChangedAfterGcodeGenerating: PropTypes.bool.isRequired,
        selectedModelArray: PropTypes.array,
        selectedToolPathModels: PropTypes.array,
        modelGroup: PropTypes.object.isRequired,
        SVGActions: PropTypes.object.isRequired,
        toolPathGroup: PropTypes.object.isRequired,
        displayedType: PropTypes.string.isRequired,
        promptTasks: PropTypes.array.isRequired,

        renderingTimestamp: PropTypes.number.isRequired,
        enableShortcut: PropTypes.bool.isRequired,
        isOverSize: PropTypes.bool,
        SVGCanvasMode: PropTypes.string.isRequired,
        SVGCanvasExt: PropTypes.object,
        // func
        selectAllElements: PropTypes.func.isRequired,
        cut: PropTypes.func.isRequired,
        copy: PropTypes.func.isRequired,
        paste: PropTypes.func.isRequired,
        clearOperationHistory: PropTypes.func.isRequired,
        undo: PropTypes.func.isRequired,
        redo: PropTypes.func.isRequired,
        initContentGroup: PropTypes.func.isRequired,
        updateTarget: PropTypes.func,
        updateScale: PropTypes.func,
        scaleCanvasToFit: PropTypes.func,

        getEstimatedTime: PropTypes.func.isRequired,
        // getSelectedModel: PropTypes.func.isRequired,
        bringSelectedModelToFront: PropTypes.func.isRequired,
        sendSelectedModelToBack: PropTypes.func.isRequired,
        arrangeAllModels2D: PropTypes.func.isRequired,
        insertDefaultTextVector: PropTypes.func.isRequired,

        onSetSelectedModelPosition: PropTypes.func.isRequired,
        onFlipSelectedModel: PropTypes.func.isRequired,
        selectModelInProcess: PropTypes.func.isRequired,
        removeSelectedModelsByCallback: PropTypes.func.isRequired,
        duplicateSelectedModel: PropTypes.func.isRequired,
        // onModelTransform: PropTypes.func.isRequired,
        // onModelAfterTransform: PropTypes.func.isRequired,

        // editor actions
        onCreateElement: PropTypes.func.isRequired,
        onSelectElements: PropTypes.func.isRequired,
        onClearSelection: PropTypes.func.isRequired,
        onMoveSelectedElementsByKey: PropTypes.func.isRequired,
        createText: PropTypes.func.isRequired,
        updateTextTransformationAfterEdit: PropTypes.func.isRequired,
        getSelectedElementsUniformScalingState: PropTypes.func.isRequired,
        checkIsOversizeImage: PropTypes.func.isRequired,
        uploadImage: PropTypes.func.isRequired,
        switchToPage: PropTypes.func.isRequired,
        updatePromptDamageModel: PropTypes.func.isRequired,
        repairSelectedModels: PropTypes.func.isRequired,

        progressStatesManager: PropTypes.object,

        elementActions: PropTypes.shape({
            moveElementsStart: PropTypes.func.isRequired,
            moveElements: PropTypes.func.isRequired,
            moveElementsFinish: PropTypes.func.isRequired,
            resizeElementsStart: PropTypes.func.isRequired,
            resizeElements: PropTypes.func.isRequired,
            resizeElementsFinish: PropTypes.func.isRequired,
            rotateElementsStart: PropTypes.func.isRequired,
            rotateElements: PropTypes.func.isRequired,
            rotateElementsFinish: PropTypes.func.isRequired,
            moveElementsOnKeyDown: PropTypes.func.isRequired,
            isPointInSelectArea: PropTypes.func.isRequired,
            getMouseTargetByCoordinate: PropTypes.func.isRequired,
            isSelectedAllVisible: PropTypes.func.isRequired
        })
    };

    private contextMenuRef = React.createRef();

    private visualizerRef = React.createRef();

    private printableArea = null;

    private svgCanvas = React.createRef();

    private canvas = React.createRef();

    private fileInput = React.createRef();

    private fileInfo = React.createRef();

    private state = {
        file: null,
    };

    private actions = {
        undo: () => {
            this.props.undo();
        },
        redo: () => {
            this.props.redo();
        },
        selectAll: () => {
            this.props.selectAllElements();
        },
        unselectAll: () => {
            this.props.onClearSelection();
        },
        copy: () => {
            this.props.copy();
        },
        paste: () => {
            this.props.paste();
        },
        cut: () => {
            this.props.cut();
        },
        onChangeFile: async (event) => {
            const file = event.target.files[0];
            const extname = path.extname(file.name).toLowerCase();
            const uploadMode = getUploadModeByFilename(file.name);

            this.setState({
                file,
                uploadMode
            });
            // Switch to PAGE_EDITOR page if new image being uploaded
            this.props.switchToPage(PAGE_EDITOR);

            if (extname === '.dxf' || extname === '.svg') {
                const fileInfo = await this.props.checkIsOversizeImage(file, () => {
                    modal({
                        cancelTitle: i18n._('key-Laser/Edit/ContextMenu-Close'),
                        title: i18n._('key-Laser/Edit/ContextMenu-Import Error'),
                        body: i18n._('Failed to import this object. \nPlease select a supported file format.')
                    });
                });
                this.fileInfo.current = fileInfo;
            } else {
                this.props.uploadImage(file, uploadMode, () => {
                    modal({
                        cancelTitle: i18n._('key-Cnc/Edit/ContextMenu-Close'),
                        title: i18n._('key-Cnc/Edit/ContextMenu-Import Error'),
                        body: i18n._('Failed to import this object. \nPlease select a supported file format.')
                    });
                });
            }
        },
        onClickLimitImage: (isLimit: boolean) => {
            this.props.uploadImage(this.state.file, this.state.uploadMode, () => {
                modal({
                    cancelTitle: i18n._('key-Laser/Edit/ContextMenu-Close'),
                    title: i18n._('key-Laser/Edit/ContextMenu-Import Error'),
                    body: i18n._('Failed to import this object. \nPlease select a supported file format.')
                });
            }, isLimit, this.fileInfo.current);
            this.fileInfo.current = null;
        },
        onClickToUpload: () => {
            this.fileInput.current.value = null;
            this.fileInput.current.click();
        },

        // canvas footer
        zoomIn: () => {
            if (this.props.page === PAGE_EDITOR) {
                this.svgCanvas.current.zoomIn();
            } else {
                this.canvas.current.zoomIn();
            }
        },
        zoomOut: () => {
            if (this.props.page === PAGE_EDITOR) {
                this.svgCanvas.current.zoomOut();
            } else {
                this.canvas.current.zoomOut();
            }
        },
        autoFocus: () => {
            this.canvas.current.setCameraOnTop();
            this.props.scaleCanvasToFit();

            const { coordinateMode, coordinateSize } = this.props;
            const target = {
                x: 0,
                y: 0
            };
            target.x += coordinateSize.x / 2 * coordinateMode.setting.sizeMultiplyFactor.x;
            target.y += coordinateSize.y / 2 * coordinateMode.setting.sizeMultiplyFactor.y;

            target.x /= 1;
            target.y /= 1;
            this.props.updateTarget(target);
        },
        onSelectModels: (intersect, selectEvent) => {
            this.props.selectModelInProcess(intersect, selectEvent);
        },
        // context menu
        bringToFront: () => {
            this.props.bringSelectedModelToFront();
        },
        sendToBack: () => {
            this.props.sendSelectedModelToBack();
        },
        onUpdateSelectedModelPosition: (position) => {
            this.props.onSetSelectedModelPosition(position);
        },
        deleteSelectedModel: (mode) => {
            this.props.removeSelectedModelsByCallback(mode);
        },
        arrangeAllModels: () => {
            this.props.arrangeAllModels2D();
        },
        duplicateSelectedModel: () => {
            this.props.duplicateSelectedModel();
        },
        rotateModel: (angle) => {
            const elements = this.props.SVGActions.svgContentGroup.selectedElements;
            const startAngle = this.props.SVGActions.svgContentGroup.getElementAngle();
            let endAngle = (startAngle + angle) % 360;
            if (endAngle > 180) {
                endAngle -= 360;
            }
            if (endAngle < -180) {
                endAngle += 360;
            }
            this.props.elementActions.rotateElementsImmediately(elements, {
                newAngle: endAngle
            });
        },
        importFile: (fileObj) => {
            if (fileObj) {
                this.actions.onChangeFile({
                    target: {
                        files: [fileObj]
                    }
                });
            } else {
                this.actions.onClickToUpload();
            }
        },
        onDrawLine: (line, closedLoop) => {
            this.props.onDrawLine(line, closedLoop);
        },
        onDrawDelete: () => {
            this.props.onDrawDelete();
        },
        onDrawTransform: ({ before, after }) => {
            this.props.onDrawTransform(before, after);
        },
        onDrawTransformComplete: ({ elem, before, after }) => {
            this.props.onDrawTransformComplete(elem, before, after);
        },
        onDrawStart: (elem) => {
            this.props.onDrawStart(elem);
        },
        onDrawComplete: (elem) => {
            this.props.onDrawComplete(elem);
        },
        onBoxSelect: (bbox, onlyContainSelect) => {
            this.props.onBoxSelect(bbox, onlyContainSelect);
        },
        setMode: (mode, extShape) => {
            this.props.setMode(mode, extShape);
        }
    };

    public constructor(props) {
        super(props);

        const { materials, origin } = props;

        const workpiece = convertMaterialsToWorkpiece(materials);
        this.printableArea = new PrintablePlate(workpiece, origin);
        this.state = {
            limitPicModalShow: false,
            file: null,
            uploadMode: ''
        };
    }

    public componentDidMount() {
        this.canvas.current.resizeWindow();
        // Set the origin to not occlude the model
        this.canvas.current.renderer.setSortObjects(false);
        this.actions.autoFocus();
        this.props.clearOperationHistory();
        UniApi.Event.on('appbar-menu:cnc.import', this.actions.importFile);
    }

    public componentWillReceiveProps(nextProps) {
        const { renderingTimestamp, isOverSize } = nextProps;

        if (!isEqual(nextProps.size, this.props.size)) {
            const { size } = nextProps;
            this.canvas.current.setCamera(new THREE.Vector3(0, 0, Math.min(size.z, VISUALIZER_CAMERA_HEIGHT)), new THREE.Vector3());
            this.actions.autoFocus();
        }

        // const { model } = nextProps;
        const { selectedToolPathModelArray } = nextProps;
        // todo, selectedModelId nof found
        if (selectedToolPathModelArray !== this.props.selectedToolPathModelArray) {
            this.canvas.current.detach();
            selectedToolPathModelArray.map(model => this.canvas.current.attach(model.meshObject, SELECTEVENT.ADDSELECT));
        }

        if (renderingTimestamp !== this.props.renderingTimestamp) {
            this.canvas.current.renderScene();
            this.canvas.current.setCameraOnTop();

            this.canvas.current.controls.panOffset.add(new THREE.Vector3(this.props.target?.x || 0, this.props.target?.y || 0, 0));
            this.canvas.current.controls.updateCamera();
        }

        if (nextProps.displayedType !== this.props.displayedType) {
            if (nextProps.displayedType === DISPLAYED_TYPE_TOOLPATH) {
                this.canvas.current.disableControls();
            } else {
                this.canvas.current.enableControls();
            }
        }
        if (nextProps.selectedToolPathModels !== this.props.selectedToolPathModels) {
            this.canvas.current.detach();
            for (const selectedToolPathModel of nextProps.selectedToolPathModels) {
                this.canvas.current.attach(selectedToolPathModel.meshObject, SELECTEVENT.ADDSELECT);
            }
        }

        if (!isEqual(nextProps.materials, this.props.materials)
            || !isEqual(nextProps.origin, this.props.origin)
        ) {
            const { materials, origin } = nextProps;
            const workpiece = convertMaterialsToWorkpiece(materials);
            this.printableArea = new PrintablePlate(workpiece, origin);
            this.actions.autoFocus();
        }

        if (isOverSize !== this.props.isOverSize) {
            this.setState({
                limitPicModalShow: isOverSize
            });
            if (isOverSize === false) {
                this.actions.onClickLimitImage(false);
            }
        }

        const { stage, promptTasks, modelGroup } = nextProps;
        if (stage !== this.props.stage) {
            if (stage === STEP_STAGE.CNC_LASER_REPAIRING_MODEL) {
                if (promptTasks && promptTasks.length > 0) {
                    const needRepairModels = promptTasks.filter(item => item.status === 'need-repair-model').map((i) => {
                        return i.model;
                    });
                    repairModelPopup(needRepairModels).then((ignore) => {
                        modelGroup.unselectAllModels();
                        modelGroup.addSelectedModels(needRepairModels);
                        this.props.repairSelectedModels();
                        this.props.updatePromptDamageModel(!ignore);
                    }).catch((ignore) => {
                        this.props.updatePromptDamageModel(!ignore);
                    });
                }
            }
        }
        this.printableArea.changeCoordinateVisibility(!nextProps.showSimulation);
    }

    public componentWillUnmount() {
        this.props.clearOperationHistory();
        UniApi.Event.off('appbar-menu:cnc.import', this.actions.importFile);
    }

    public getNotice() {
        const { stage } = this.props;
        return this.props.progressStatesManager.getNotice(stage);
    }

    public showContextMenu = (event) => {
        const model = this.props.SVGActions.getSVGModelByElement(event.target);
        if (this.props.modelGroup.selectedModelArray.length > 1 && this.props.modelGroup.selectedModelArray.includes(model)) {
            return;
        }
        if (model) {
            this.props.onClearSelection();
            this.props.onSelectElements([event.target]);
        }
        this.contextMenuRef.current.show(event);
    };

    public addControllerEvents() {
        Object.keys(this.controllerEvents).forEach(eventName => {
            const callback = this.controllerEvents[eventName];
            controller.on(eventName, callback);
        });
    }

    public removeControllerEvents() {
        Object.keys(this.controllerEvents).forEach(eventName => {
            const callback = this.controllerEvents[eventName];
            controller.off(eventName, callback);
        });
    }

    public render() {
        const isOnlySelectedOneModel = (this.props.selectedModelArray && this.props.selectedModelArray.length === 1);

        const estimatedTime = this.props.displayedType === DISPLAYED_TYPE_TOOLPATH && !this.props.isChangedAfterGcodeGenerating ? this.props.getEstimatedTime('selected') : '';
        const notice = this.getNotice();
        const progress = this.props.progress;
        const contextMenuDisabled = !isOnlySelectedOneModel || !this.props.selectedModelArray[0].visible;
        const { displayedType } = this.props;
        const pasteDisabled = (this.props.modelGroup.clipboard.length === 0);
        const editable = true;

        return (
            <div
                ref={this.visualizerRef}
            >
                {(displayedType === DISPLAYED_TYPE_TOOLPATH) && (
                    <div>
                        <VisualizerTopRight
                            headType="cnc"
                        />
                    </div>
                )}
                <div style={{
                    visibility: (displayedType !== DISPLAYED_TYPE_TOOLPATH) ? 'visible' : 'hidden'
                }}
                >
                    <SVGEditor
                        isActive={!this.props.currentModalPath && this.props.pathname.indexOf('cnc') > 0 && this.props.enableShortcut}
                        ref={this.svgCanvas}
                        editable={editable}
                        SVGCanvasMode={this.props.SVGCanvasMode}
                        SVGCanvasExt={this.props.SVGCanvasExt}
                        size={this.props.size}
                        menuDisabledCount={this.props.menuDisabledCount}
                        initContentGroup={this.props.initContentGroup}
                        scale={this.props.scale}
                        minScale={MIN_LASER_CNC_CANVAS_SCALE}
                        maxScale={MAX_LASER_CNC_CANVAS_SCALE}
                        target={this.props.target}
                        coordinateMode={this.props.coordinateMode}
                        coordinateSize={this.props.coordinateSize}
                        workpiece={this.props.workpiece}
                        origin={this.props.origin}
                        updateTarget={this.props.updateTarget}
                        updateScale={this.props.updateScale}
                        SVGActions={this.props.SVGActions}
                        materials={this.props.materials}
                        insertDefaultTextVector={this.props.insertDefaultTextVector}
                        showContextMenu={this.showContextMenu}
                        onCreateElement={this.props.onCreateElement}
                        onSelectElements={this.props.onSelectElements}
                        onClearSelection={this.props.onClearSelection}
                        elementActions={this.props.elementActions}
                        editorActions={this.actions}
                        getSelectedElementsUniformScalingState={this.props.getSelectedElementsUniformScalingState}
                        onMoveSelectedElementsByKey={this.props.onMoveSelectedElementsByKey}
                        createText={this.props.createText}
                        updateTextTransformationAfterEdit={this.props.updateTextTransformationAfterEdit}
                        onChangeFile={this.actions.onChangeFile}
                        onClickToUpload={this.actions.onClickToUpload}
                        fileInput={this.fileInput}
                        allowedFiles=".svg, .png, .jpg, .jpeg, .bmp, .dxf, .stl, .amf, .3mf"
                        headType={HEAD_CNC}
                    />
                </div>
                <div
                    className={classNames(styles['canvas-content'], styles['canvas-wrapper'])}
                    style={{
                        visibility: (displayedType === DISPLAYED_TYPE_TOOLPATH) ? 'visible' : 'hidden'
                    }}
                >
                    <Canvas
                        ref={this.canvas}
                        canOperateModel={false}
                        size={this.props.size}
                        modelGroup={this.props.modelGroup}
                        toolPathGroupObject={this.props.toolPathGroup.object}
                        printableArea={this.printableArea}
                        cameraInitialPosition={new THREE.Vector3(0, 0, VISUALIZER_CAMERA_HEIGHT)}
                        cameraInitialTarget={new THREE.Vector3(0, 0, 0)}
                        onSelectModels={this.actions.onSelectModels}
                        onModelAfterTransform={noop}
                        showContextMenu={this.showContextMenu}
                        scale={this.props.scale}
                        minScale={MIN_LASER_CNC_CANVAS_SCALE}
                        maxScale={MAX_LASER_CNC_CANVAS_SCALE}
                        scaleSize={VISUALIZER_CAMERA_HEIGHT}
                        target={this.props.target}
                        coordinateMode={this.props.coordinateMode}
                        coordinateSize={this.props.coordinateSize}
                        updateTarget={this.props.updateTarget}
                        updateScale={this.props.updateScale}
                        transformSourceType="2D"
                    />
                </div>
                <div className="position-absolute left-68 bottom-16">
                    <VisualizerBottomLeft
                        headType={HEAD_CNC}
                        scale={this.props.scale}
                        minScale={MIN_LASER_CNC_CANVAS_SCALE}
                        maxScale={MAX_LASER_CNC_CANVAS_SCALE}
                        updateScale={this.props.updateScale}
                        zoomIn={this.actions.zoomIn}
                        zoomOut={this.actions.zoomOut}
                        toFront={this.actions.autoFocus}
                    />
                </div>
                {estimatedTime && (
                    <div className={styles['visualizer-info']}>
                        <span className="fa fa-clock-o" />
                        <Space width={4} />
                        {humanReadableTime(estimatedTime)}
                    </div>
                )}
                <div className={styles['visualizer-progress']}>
                    <ProgressBar tips={notice} progress={progress * 100} />
                </div>
                <ContextMenu
                    ref={this.contextMenuRef}
                    id="cnc"
                    menuItems={
                        [
                            {
                                type: 'item',
                                label: i18n._('key-Cnc/Edit/ContextMenu-Cut'),
                                disabled: contextMenuDisabled,
                                onClick: this.actions.cut
                            },
                            {
                                type: 'item',
                                label: i18n._('key-Cnc/Edit/ContextMenu-Copy'),
                                disabled: contextMenuDisabled,
                                onClick: this.actions.copy
                            },
                            {
                                type: 'item',
                                label: i18n._('key-Cnc/Edit/ContextMenu-Paste'),
                                disabled: pasteDisabled,
                                onClick: this.actions.paste
                            },
                            {
                                type: 'item',
                                label: i18n._('key-Cnc/Edit/ContextMenu-Duplicate'),
                                disabled: contextMenuDisabled,
                                onClick: this.actions.duplicateSelectedModel
                            },
                            {
                                type: 'separator'
                            },
                            {
                                type: 'subMenu',
                                label: i18n._('key-Cnc/Edit/ContextMenu-Arrange'),
                                disabled: contextMenuDisabled,
                                items: [
                                    {
                                        type: 'item',
                                        label: i18n._('key-Cnc/Edit/ContextMenu-Bring to Front'),
                                        onClick: () => this.actions.bringToFront()
                                    },
                                    {
                                        type: 'item',
                                        label: i18n._('key-Cnc/Edit/ContextMenu-Send to Back'),
                                        onClick: () => this.actions.sendToBack()
                                    }
                                ]
                            },
                            {
                                type: 'subMenu',
                                label: i18n._('key-Cnc/Edit/ContextMenu-Transform'),
                                disabled: contextMenuDisabled,
                                items: [
                                    {
                                        type: 'item',
                                        label: i18n._('key-Cnc/Edit/ContextMenu-Rotate 180°'),
                                        onClick: () => this.actions.rotateModel(180)
                                    },
                                    {
                                        type: 'item',
                                        label: i18n._('key-Cnc/Edit/ContextMenu-Rotate 90° Clockwise'),
                                        onClick: () => this.actions.rotateModel(90)
                                    },
                                    {
                                        type: 'item',
                                        label: i18n._('key-Cnc/Edit/ContextMenu-Rotate 90° Counter Clockwise'),
                                        onClick: () => this.actions.rotateModel(-90)
                                    },
                                    {
                                        type: 'item',
                                        label: i18n._('key-Cnc/Edit/ContextMenu-Flip Horizontal'),
                                        onClick: () => this.props.onFlipSelectedModel('Horizontal')
                                    },
                                    {
                                        type: 'item',
                                        label: i18n._('key-Cnc/Edit/ContextMenu-Flip Vertical'),
                                        onClick: () => this.props.onFlipSelectedModel('Vertical')
                                    }
                                ]
                            }
                        ]
                    }
                />
                {this.state.limitPicModalShow && (
                    <Modal
                        open={this.state.limitPicModalShow}
                        onClose={() => {
                            this.setState({ limitPicModalShow: false });
                            this.actions.onClickLimitImage(false);
                        }}
                    >
                        <Modal.Header>
                            {i18n._('Key-Laser/ImportScale-Scale To Fit')}
                        </Modal.Header>
                        <Modal.Body>
                            <div className={styles['width-480']}>
                                {i18n._('Key-Laser/ImportScale-Object size has exceeded the work size. Scale it to the maximum work size?')}
                            </div>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button
                                priority="level-two"
                                type="default"
                                className="align-r margin-right-8"
                                width="96px"
                                onClick={() => {
                                    this.setState({ limitPicModalShow: false });
                                    this.actions.onClickLimitImage(false);
                                }}
                            >
                                {i18n._('key-Printing/ImportScale--Cancel')}
                            </Button>
                            <Button
                                priority="level-two"
                                className="align-r"
                                width="96px"
                                onClick={() => {
                                    this.setState({ limitPicModalShow: false });
                                    this.actions.onClickLimitImage(true);
                                }}
                            >
                                {i18n._('key-Printing/ImportScale--Scale')}
                            </Button>
                        </Modal.Footer>
                    </Modal>
                )}
            </div>
        );
    }
}

const mapStateToProps = (state, ownProps) => {
    // call canvas.updateTransformControl2D() when transformation changed or model selected changed
    const { size, series } = state.machine;
    const { currentModalPath, menuDisabledCount } = state.appbarMenu;
    const {
        page, materials, modelGroup, toolPathGroup, displayedType, hasModel, isChangedAfterGcodeGenerating,
        renderingTimestamp, stage, progress, SVGActions, scale, target,
        showSimulation, progressStatesManager, enableShortcut, isOverSize, SVGCanvasMode, SVGCanvasExt,
        promptTasks,
        // coordinate
        coordinateMode,
        coordinateSize,
    } = state.cnc;

    const workpiece: Workpiece = state.cnc.workpiece;
    const origin: Origin = state.cnc.origin;

    const selectedModelArray = modelGroup.getSelectedModelArray();
    const selectedModelID = modelGroup.getSelectedModel().modelID;
    const selectedToolPathModels = modelGroup.getSelectedToolPathModels();
    const multipleMaterials = {
        ...materials,
        headType: HEAD_CNC,
    };

    return {
        series,
        enableShortcut,
        progressStatesManager,
        currentModalPath,
        showSimulation,
        menuDisabledCount,
        // switch pages trigger pathname change
        pathname: ownProps.location.pathname,
        page,
        scale,
        target,
        materials: multipleMaterials,
        size,
        coordinateMode,
        coordinateSize,
        workpiece,
        origin,
        // model,
        modelGroup,
        SVGActions,
        displayedType,
        toolPathGroup,
        selectedModelArray,
        selectedToolPathModels,
        selectedModelID,
        hasModel,
        renderingTimestamp,
        isChangedAfterGcodeGenerating,
        stage,
        progress,
        isOverSize,
        SVGCanvasMode,
        SVGCanvasExt,
        promptTasks,
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        clearOperationHistory: () => dispatch(operationHistoryActions.clear('cnc')),
        undo: () => dispatch(editorActions.undo('cnc')),
        redo: () => dispatch(editorActions.redo('cnc')),
        initContentGroup: (svgContentGroup) => dispatch(editorActions.initContentGroup('cnc', svgContentGroup)),
        updateTarget: (target) => dispatch(editorActions.updateState('cnc', { target })),
        updateScale: (scale) => dispatch(editorActions.updateState('cnc', { scale })),
        scaleCanvasToFit: () => dispatch(editorActions.scaleCanvasToFit('cnc')),
        getEstimatedTime: (type) => dispatch(editorActions.getEstimatedTime('cnc', type)),
        getSelectedModel: () => dispatch(editorActions.getSelectedModel('cnc')),
        bringSelectedModelToFront: () => dispatch(editorActions.bringSelectedModelToFront('cnc')),
        insertDefaultTextVector: () => dispatch(editorActions.insertDefaultTextVector('cnc')),
        sendSelectedModelToBack: () => dispatch(editorActions.sendSelectedModelToBack('cnc')),
        arrangeAllModels2D: () => dispatch(editorActions.arrangeAllModels2D('cnc')),
        onSetSelectedModelPosition: (position) => dispatch(editorActions.onSetSelectedModelPosition('cnc', position)),
        onFlipSelectedModel: (flip) => dispatch(editorActions.onFlipSelectedModel('cnc', flip)),
        selectModelInProcess: (intersect, selectEvent) => dispatch(editorActions.selectModelInProcess('cnc', intersect, selectEvent)),
        duplicateSelectedModel: () => dispatch(editorActions.duplicateSelectedModel('cnc')),
        removeSelectedModelsByCallback: (mode) => dispatch(editorActions.removeSelectedModelsByCallback('cnc', mode)),
        cut: () => dispatch(editorActions.cut('cnc')),
        copy: () => dispatch(editorActions.copy('cnc')),
        paste: () => dispatch(editorActions.paste('cnc')),
        onCreateElement: (element) => dispatch(editorActions.createModelFromElement('cnc', element)),
        selectAllElements: () => dispatch(editorActions.selectAllElements('cnc')),
        onSelectElements: (elements) => dispatch(editorActions.selectElements('cnc', elements)),
        onClearSelection: () => dispatch(editorActions.clearSelection('cnc')),
        onMoveSelectedElementsByKey: () => dispatch(editorActions.moveElementsOnKeyUp('cnc')),
        getSelectedElementsUniformScalingState: () => dispatch(editorActions.getSelectedElementsUniformScalingState('cnc')),

        createText: (text) => dispatch(editorActions.createText('cnc', text)),
        updateTextTransformationAfterEdit: (element, transformation) => dispatch(editorActions.updateModelTransformationByElement('cnc', element, transformation)),

        uploadImage: (file, mode, onFailure, isLimit, fileInfo) => dispatch(editorActions.uploadImage('cnc', file, mode, onFailure, isLimit, fileInfo)),
        switchToPage: (page) => dispatch(editorActions.switchToPage('cnc', page)),
        checkIsOversizeImage: (file, onFailure) => dispatch(editorActions.checkIsOversizeImage('cnc', file, onFailure)),

        onDrawLine: (line, closedLoop) => dispatch(editorActions.drawLine('cnc', line, closedLoop)),
        onDrawDelete: () => dispatch(editorActions.drawDelete('cnc')),
        onDrawTransform: (before, after) => dispatch(editorActions.drawTransform('cnc', before, after)),
        onDrawTransformComplete: (elem, before, after) => dispatch(editorActions.drawTransformComplete('cnc', elem, before, after)),
        onDrawStart: (elem) => dispatch(editorActions.drawStart('cnc', elem)),
        onDrawComplete: (elem) => dispatch(editorActions.drawComplete('cnc', elem)),
        onBoxSelect: (bbox, onlyContainSelect) => dispatch(editorActions.boxSelect('cnc', bbox, onlyContainSelect)),
        setMode: (mode, ext) => dispatch(editorActions.setCanvasMode('cnc', mode, ext)),
        updatePromptDamageModel: (bool) => dispatch(machineActions.updatePromptDamageModel(bool)),
        repairSelectedModels: () => dispatch(editorActions.repairSelectedModels('cnc')),

        elementActions: {
            moveElementsStart: (elements, options) => dispatch(editorActions.moveElementsStart('cnc', elements, options)),
            moveElements: (elements, options) => dispatch(editorActions.moveElements('cnc', elements, options)),
            moveElementsFinish: (elements, options) => dispatch(editorActions.moveElementsFinish('cnc', elements, options)),
            resizeElementsStart: (elements, options) => dispatch(editorActions.resizeElementsStart('cnc', elements, options)),
            resizeElements: (elements, options) => dispatch(editorActions.resizeElements('cnc', elements, options)),
            resizeElementsFinish: (elements, options) => dispatch(editorActions.resizeElementsFinish('cnc', elements, options)),
            rotateElementsStart: (elements, options) => dispatch(editorActions.rotateElementsStart('cnc', elements, options)),
            rotateElements: (elements, options) => dispatch(editorActions.rotateElements('cnc', elements, options)),
            rotateElementsFinish: (elements, options) => dispatch(editorActions.rotateElementsFinish('cnc', elements, options)),
            moveElementsOnKeyDown: (options) => dispatch(editorActions.moveElementsOnKeyDown('cnc', null, options)),
            rotateElementsImmediately: (elements, options) => dispatch(editorActions.rotateElementsImmediately('cnc', elements, options)),
            isPointInSelectArea: (x, y) => dispatch(editorActions.isPointInSelectArea('cnc', x, y)),
            getMouseTargetByCoordinate: (x, y) => dispatch(editorActions.getMouseTargetByCoordinate('cnc', x, y)),
            isSelectedAllVisible: () => dispatch(editorActions.isSelectedAllVisible('cnc'))
        }
        // onModelTransform: () => dispatch(editorActions.onModelTransform('cnc')),
        // onModelAfterTransform: () => dispatch(editorActions.onModelAfterTransform('cnc'))
    };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(Visualizer));
