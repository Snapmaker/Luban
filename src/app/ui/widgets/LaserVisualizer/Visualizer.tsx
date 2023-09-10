import classNames from 'classnames';
import isEqual from 'lodash/isEqual';
import noop from 'lodash/noop';
import path from 'path';
import PropTypes from 'prop-types';
import React from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router-dom';
import * as THREE from 'three';
import { Group } from 'three';

import {
    DISPLAYED_TYPE_TOOLPATH,
    HEAD_LASER,
    MAX_LASER_CNC_CANVAS_SCALE,
    MIN_LASER_CNC_CANVAS_SCALE,
    PAGE_EDITOR,
    PROCESS_MODE_GREYSCALE,
    PROCESS_MODE_VECTOR,
    Page,
    SELECTEVENT,
    VISUALIZER_CAMERA_HEIGHT
} from '../../../constants';
import { Origin, Workpiece, WorkpieceShape, convertMaterialsToWorkpiece } from '../../../constants/coordinate';
import { actions as editorActions } from '../../../flux/editor';
import { actions as operationHistoryActions } from '../../../flux/operation-history';
import i18n from '../../../lib/i18n';
import modal from '../../../lib/modal';
import { humanReadableTime } from '../../../lib/time-utils';
import UniApi from '../../../lib/uni-api';
import ModelGroup from '../../../models/ModelGroup';
import SVGEditor from '../../SVGEditor';
import { Button } from '../../components/Buttons';
import ContextMenu from '../../components/ContextMenu';
import Modal from '../../components/Modal';
import ProgressBar from '../../components/ProgressBar';
import Canvas from '../../components/SMCanvas';
import Space from '../../components/Space';
import { PageMode } from '../../pages/PageMode';
import SVGClippingOverlay from '../../views/model-operation-overlay/SVGClippingOverlay';
import PrintablePlate from '../CncLaserShared/PrintablePlate';
import VisualizerBottomLeft from '../CncLaserShared/VisualizerBottomLeft';
import VisualizerTopRight from '../CncLaserTopRight/VisualizerTopRight';
import styles from './styles.styl';
import ToolPathGroup from '../../../toolpaths/ToolPathGroup';

interface VisualizerProps {
    // page: editor or preview
    page: Page;
    pageMode: PageMode;
    setPageMode: (pageMode: PageMode) => void;

    // objects and models
    modelGroup: ModelGroup;
    toolPathGroup: ToolPathGroup;
    printableArea: PrintablePlate;

    // a `Group` contains background objects
    backgroundGroup: Group;

    updateTarget: (target) => void;

    // Origin
    workpiece: Workpiece;
    origin: Origin;

    // actions
    undo: () => void;
    redo: () => void;
}


class Visualizer extends React.Component<VisualizerProps> {
    public static propTypes = {
        ...withRouter.propTypes,
        series: PropTypes.string.isRequired,
        pathname: PropTypes.string,
        page: PropTypes.string.isRequired,
        stage: PropTypes.number.isRequired,
        progress: PropTypes.number.isRequired,

        materials: PropTypes.object,
        coordinateMode: PropTypes.object.isRequired,
        coordinateSize: PropTypes.object.isRequired,
        origin: PropTypes.object.isRequired,
        size: PropTypes.object.isRequired,

        scale: PropTypes.number.isRequired,
        target: PropTypes.object,
        menuDisabledCount: PropTypes.number,
        // model: PropTypes.object,
        // selectedModelID: PropTypes.string,
        selectedModelArray: PropTypes.array,
        selectedToolPathModelArray: PropTypes.array,
        backgroundGroup: PropTypes.object.isRequired,
        modelGroup: PropTypes.object.isRequired,
        SVGActions: PropTypes.object.isRequired,
        toolPathGroup: PropTypes.object.isRequired,
        shouldGenerateGcodeCounter: PropTypes.number.isRequired,
        displayedType: PropTypes.string.isRequired,
        renderingTimestamp: PropTypes.number.isRequired,
        isChangedAfterGcodeGenerating: PropTypes.bool.isRequired,
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
        uploadImage: PropTypes.func.isRequired,
        checkIsOversizeImage: PropTypes.func.isRequired,
        cutModel: PropTypes.func.isRequired,
        switchToPage: PropTypes.func.isRequired,

        progressStatesManager: PropTypes.object.isRequired,

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
        }),

        pageMode: PropTypes.string.isRequired,
        setPageMode: PropTypes.func.isRequired
    };

    private contextMenuRef = React.createRef();

    private visualizerRef = React.createRef();

    private printableArea = null;

    private svgCanvas = React.createRef();

    private canvas = React.createRef<Canvas>();

    private fileInput = React.createRef();

    private fileInfo = React.createRef();

    private uploadExts = '.svg, .png, .jpg, .jpeg, .bmp, .dxf';

    private allowedFiles = '';

    public actions = {
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
            if (extname === '.stl' && this.props.materials.isRotate) {
                modal({
                    cancelTitle: i18n._('key-Laser/Edit/ContextMenu-Close'),
                    title: i18n._('key-Laser/Edit/ContextMenu-Import Error'),
                    body: i18n._('Failed to import this object. \nPlease select a supported file format.')
                });
                return;
            }
            let uploadMode;
            if (extname === '.svg') {
                uploadMode = PROCESS_MODE_VECTOR;
            } else if (extname === '.dxf') {
                uploadMode = PROCESS_MODE_VECTOR;
            } else {
                uploadMode = PROCESS_MODE_GREYSCALE;
            }
            this.setState({
                file,
                uploadMode
            });
            // Switch to PAGE_EDITOR page if new image being uploaded
            this.props.switchToPage(PAGE_EDITOR);
            if ((extname === '.stl' || extname === '.amf' || extname === '.3mf') && !this.props.materials.isRotate) {
                this.props.cutModel(file, () => {
                    modal({
                        cancelTitle: i18n._('key-Laser/Edit/ContextMenu-Close'),
                        title: i18n._('key-Laser/Edit/ContextMenu-Import Error'),
                        body: i18n._('Failed to import this object. \nPlease select a supported file format.')
                    });
                });
            } else if (extname === '.dxf' || extname === '.svg' || extname === '.png' || extname === '.jpg' || extname === '.jpeg' || extname === '.jpeg, .bmp') {
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
                        cancelTitle: i18n._('key-Laser/Edit/ContextMenu-Close'),
                        title: i18n._('key-Laser/Edit/ContextMenu-Import Error'),
                        body: i18n._('Failed to import this object. \nPlease select a supported file format.')
                    });
                }, true);
            }
        },
        onClickLimitImage: (isLimit) => {
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
        onSelectModels: (intersect, selectEvent) => { // this is a toolpath model? mesh object??
            // todo
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
        onDrawDelete: (lines) => {
            this.props.onDrawDelete(lines);
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

    // hideContextMenu = () => {
    //     ContextMenu.hide();
    // };

    public componentDidMount() {
        this.canvas.current.resizeWindow();
        // Set the origin to not occlude the model
        this.canvas.current.renderer.setSortObjects(false);
        this.actions.autoFocus();
        this.props.clearOperationHistory();
        UniApi.Event.on('appbar-menu:laser.import', this.actions.importFile);
    }

    public componentWillReceiveProps(nextProps) {
        const { renderingTimestamp, isOverSize } = nextProps;

        // const { model } = nextProps;
        const { selectedToolPathModelArray } = nextProps;
        // todo, selectedModelId nof found
        if (selectedToolPathModelArray !== this.props.selectedToolPathModelArray) {
            this.canvas.current.detach();
            selectedToolPathModelArray.map(model => this.canvas.current.controls.attach(model.meshObject, SELECTEVENT.ADDSELECT));
        }

        // TODO: Occasionally cannot find 'controls', error on finding 'panOffset' of 'undefined'
        if (renderingTimestamp !== this.props.renderingTimestamp) {
            this.canvas.current.renderScene();
        }

        if (nextProps.shouldGenerateGcodeCounter !== this.props.shouldGenerateGcodeCounter) {
            const { min, max } = nextProps.toolPathGroup.getBoundingBox();
            const target = new THREE.Vector3();

            target.copy(min).add(max).divideScalar(2);
            const width = new THREE.Vector3().add(min).distanceTo(new THREE.Vector3().add(max));
            const position = new THREE.Vector3(target.x, target.y, width * 2);
            this.canvas.current && this.canvas.current.setCamera(position, target);
        }

        if (nextProps.displayedType !== this.props.displayedType) {
            if (nextProps.displayedType === DISPLAYED_TYPE_TOOLPATH) {
                this.canvas.current.controls.disableClick();
            } else {
                this.canvas.current.controls.enableClick();
            }
        }

        if (!isEqual(nextProps.size, this.props.size)) {
            this.canvas.current.setCamera(new THREE.Vector3(0, 0, VISUALIZER_CAMERA_HEIGHT), new THREE.Vector3());
        }

        if (!isEqual(nextProps.workpiece, this.props.workpiece) || !isEqual(nextProps.origin, this.props.origin)) {
            const { workpiece, origin } = nextProps;

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

        this.allowedFiles = (nextProps.workpiece.shape === WorkpieceShape.Cylinder ? this.uploadExts : `${this.uploadExts}, .stl, .amf, .3mf`);
    }

    public componentWillUnmount() {
        this.props.clearOperationHistory();
        UniApi.Event.off('appbar-menu:laser.import', this.actions.importFile);
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

    public render() {
        // const isModelSelected = !!this.props.selectedModelID;
        const isOnlySelectedOneModel = (this.props.selectedModelArray && this.props.selectedModelArray.length > 0);
        // const hasModel = this.props.hasModel;

        const estimatedTime = this.props.displayedType === DISPLAYED_TYPE_TOOLPATH && !this.props.isChangedAfterGcodeGenerating ? this.props.getEstimatedTime('selected') : '';
        const notice = this.getNotice();
        const progress = this.props.progress;
        const contextMenuDisabled = !isOnlySelectedOneModel || !this.props.selectedModelArray[0].visible;
        const displayedType = this.props.displayedType;
        const pasteDisabled = (this.props.modelGroup.clipboard.length === 0);
        const editable = true;

        return (
            <div
                ref={this.visualizerRef}
            >
                {(displayedType === DISPLAYED_TYPE_TOOLPATH) && (
                    <div>
                        <VisualizerTopRight
                            headType="laser"
                        />
                    </div>
                )}
                <div style={{
                    visibility: (displayedType !== DISPLAYED_TYPE_TOOLPATH) ? 'visible' : 'hidden'
                }}
                >
                    <SVGEditor
                        editable={editable}
                        SVGCanvasMode={this.props.SVGCanvasMode}
                        SVGCanvasExt={this.props.SVGCanvasExt}
                        isActive={!this.props.currentModalPath && this.props.pathname.indexOf('laser') > 0 && this.props.enableShortcut}
                        ref={this.svgCanvas}
                        menuDisabledCount={this.props.menuDisabledCount}
                        size={this.props.size}
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
                        editorActions={this.actions}
                        elementActions={this.props.elementActions}
                        getSelectedElementsUniformScalingState={this.props.getSelectedElementsUniformScalingState}
                        onMoveSelectedElementsByKey={this.props.onMoveSelectedElementsByKey}
                        createText={this.props.createText}
                        updateTextTransformationAfterEdit={this.props.updateTextTransformationAfterEdit}
                        onChangeFile={this.actions.onChangeFile}
                        onClickToUpload={this.actions.onClickToUpload}
                        fileInput={this.fileInput}
                        allowedFiles={this.allowedFiles}
                        headType={HEAD_LASER}
                        showSVGShapeLibrary={this.props.showSVGShapeLibrary}
                        updateEditorState={this.props.updateEditorState}
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
                        modelGroup={this.props.modelGroup}
                        backgroundGroup={this.props.backgroundGroup}
                        toolPathGroupObject={this.props.toolPathGroup.object}
                        printableArea={this.printableArea}
                        cameraInitialPosition={new THREE.Vector3(0, 0, VISUALIZER_CAMERA_HEIGHT)}
                        cameraInitialTarget={new THREE.Vector3(0, 0, 0)}
                        onSelectModels={this.actions.onSelectModels}
                        onModelAfterTransform={noop}
                        showContextMenu={this.showContextMenu}
                        minScale={MIN_LASER_CNC_CANVAS_SCALE}
                        maxScale={MAX_LASER_CNC_CANVAS_SCALE}
                        scaleSize={VISUALIZER_CAMERA_HEIGHT}
                        transformSourceType="2D"
                    />
                </div>
                <div className="position-absolute left-68 bottom-16">
                    <VisualizerBottomLeft
                        headType={HEAD_LASER}
                        scale={this.props.scale}
                        minScale={MIN_LASER_CNC_CANVAS_SCALE}
                        maxScale={MAX_LASER_CNC_CANVAS_SCALE}
                        updateScale={this.props.updateScale}
                        zoomIn={this.actions.zoomIn}
                        zoomOut={this.actions.zoomOut}
                        toFront={this.actions.autoFocus}
                        displayedType={this.props.displayedType}
                    />
                </div>
                {estimatedTime && (
                    <div className={styles['visualizer-info']}>
                        <span className="fa fa-clock-o" />
                        <Space width={4} />
                        {humanReadableTime(estimatedTime)}
                    </div>
                )}

                <div>
                    <ProgressBar tips={notice} progress={progress * 100} />
                </div>
                <ContextMenu
                    ref={this.contextMenuRef}
                    id="laser"
                    menuItems={
                        [
                            {
                                type: 'item',
                                label: i18n._('key-Laser/Edit/ContextMenu-Cut'),
                                disabled: contextMenuDisabled,
                                onClick: this.actions.cut
                            },
                            {
                                type: 'item',
                                label: i18n._('key-Laser/Edit/ContextMenu-Copy'),
                                disabled: contextMenuDisabled,
                                onClick: this.actions.copy
                            },
                            {
                                type: 'item',
                                label: i18n._('key-Laser/Edit/ContextMenu-Paste'),
                                disabled: pasteDisabled,
                                onClick: this.actions.paste
                            },
                            {
                                type: 'item',
                                label: i18n._('key-Laser/Edit/ContextMenu-Duplicate'),
                                disabled: contextMenuDisabled,
                                onClick: this.actions.duplicateSelectedModel
                            },
                            {
                                type: 'separator'
                            },
                            {
                                type: 'subMenu',
                                label: i18n._('key-Laser/Edit/ContextMenu-Arrange'),
                                disabled: contextMenuDisabled,
                                items: [
                                    {
                                        type: 'item',
                                        label: i18n._('key-Laser/Edit/ContextMenu-Bring to Front'),
                                        onClick: () => this.actions.bringToFront()
                                    },
                                    {
                                        type: 'item',
                                        label: i18n._('key-Laser/Edit/ContextMenu-Send to Back'),
                                        onClick: () => this.actions.sendToBack()
                                    }
                                ]
                            },
                            {
                                type: 'subMenu',
                                label: i18n._('key-Laser/Edit/ContextMenu-Transform'),
                                disabled: contextMenuDisabled,
                                items: [
                                    {
                                        type: 'item',
                                        label: i18n._('key-Laser/Edit/ContextMenu-Rotate 180°'),
                                        onClick: () => this.actions.rotateModel(180)
                                    },
                                    {
                                        type: 'item',
                                        label: i18n._('key-Laser/Edit/ContextMenu-Rotate 90° Clockwise'),
                                        onClick: () => this.actions.rotateModel(90)
                                    },
                                    {
                                        type: 'item',
                                        label: i18n._('key-Laser/Edit/ContextMenu-Rotate 90° Counter Clockwise'),
                                        onClick: () => this.actions.rotateModel(-90)
                                    },
                                    {
                                        type: 'item',
                                        label: i18n._('key-Laser/Edit/ContextMenu-Flip Horizontal'),
                                        onClick: () => this.props.onFlipSelectedModel('Horizontal')
                                    },
                                    {
                                        type: 'item',
                                        label: i18n._('key-Laser/Edit/ContextMenu-Flip Vertical'),
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

                {/* Simplify Model */
                    this.props.pageMode === PageMode.SVGClipping && (
                        <div className={styles['visualizer-Overlay-left']}>
                            <SVGClippingOverlay
                                onClose={() => { this.props.setPageMode(PageMode.Default); }}
                            />
                        </div>
                    )
                }
            </div>
        );
    }
}

const mapStateToProps = (state, ownProps) => {
    const { size, series } = state.machine;
    const { currentModalPath, menuDisabledCount } = state.appbarMenu;

    // objects or models
    const modelGroup: ModelGroup = state.laser.modelGroup;
    const toolPathGroup: ToolPathGroup = state.laser.toolPathGroup;

    const background: { enabled: boolean; group: Group } = state.laser.background;

    const { progressStatesManager, shouldGenerateGcodeCounter } = state.laser;
    const {
        SVGActions, scale, target, materials, page, selectedModelID, svgModelGroup, displayedType,
        isChangedAfterGcodeGenerating, renderingTimestamp, stage, progress,
        coordinateMode, coordinateSize,
        enableShortcut, isOverSize, SVGCanvasMode, SVGCanvasExt,
    } = state.laser;

    const workpiece: Workpiece = state.laser.workpiece;
    const origin: Origin = state.laser.origin;

    const { showSVGShapeLibrary } = state.editor;
    const selectedModelArray = modelGroup.getSelectedModelArray();
    const selectedToolPathModelArray = modelGroup.getSelectedToolPathModels();

    return {
        enableShortcut,
        currentModalPath,
        progressStatesManager,
        menuDisabledCount,
        // switch pages trigger pathname change
        pathname: ownProps.location.pathname,
        page,
        scale,
        target,
        SVGActions,
        size,
        series,
        coordinateMode,
        coordinateSize,
        workpiece,
        origin,
        materials,
        hasModel: modelGroup.hasModel(),
        selectedModelID,
        svgModelGroup,
        modelGroup,
        toolPathGroup,
        shouldGenerateGcodeCounter,
        displayedType,
        selectedModelArray,
        selectedToolPathModelArray,
        isChangedAfterGcodeGenerating,
        // model,
        backgroundGroup: background.group,
        renderingTimestamp,
        stage,
        progress,
        isOverSize,
        SVGCanvasMode,
        SVGCanvasExt,
        showSVGShapeLibrary
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        clearOperationHistory: () => dispatch(operationHistoryActions.clear('laser')),
        undo: () => dispatch(editorActions.undo('laser')),
        redo: () => dispatch(editorActions.redo('laser')),
        initContentGroup: (svgContentGroup) => dispatch(editorActions.initContentGroup('laser', svgContentGroup)),
        updateTarget: (target) => dispatch(editorActions.updateState('laser', { target })),
        updateScale: (scale) => dispatch(editorActions.updateState('laser', { scale })),
        scaleCanvasToFit: () => dispatch(editorActions.scaleCanvasToFit('laser')),
        getEstimatedTime: (type) => dispatch(editorActions.getEstimatedTime('laser', type)),
        getSelectedModel: () => dispatch(editorActions.getSelectedModel('laser')),
        bringSelectedModelToFront: () => dispatch(editorActions.bringSelectedModelToFront('laser')),
        sendSelectedModelToBack: () => dispatch(editorActions.sendSelectedModelToBack('laser')),
        arrangeAllModels2D: () => dispatch(editorActions.arrangeAllModels2D('laser')),
        insertDefaultTextVector: () => dispatch(editorActions.insertDefaultTextVector('laser')),
        onSetSelectedModelPosition: (position) => dispatch(editorActions.onSetSelectedModelPosition('laser', position)),
        onFlipSelectedModel: (flip) => dispatch(editorActions.onFlipSelectedModel('laser', flip)),
        selectModelInProcess: (intersect, selectEvent) => dispatch(editorActions.selectModelInProcess('laser', intersect, selectEvent)),
        removeSelectedModelsByCallback: (mode) => dispatch(editorActions.removeSelectedModelsByCallback('laser', mode)),
        duplicateSelectedModel: () => dispatch(editorActions.duplicateSelectedModel('laser')),

        cut: () => dispatch(editorActions.cut('laser')),
        copy: () => dispatch(editorActions.copy('laser')),
        paste: () => dispatch(editorActions.paste('laser')),
        onCreateElement: (element) => dispatch(editorActions.createModelFromElement('laser', element)),
        selectAllElements: () => dispatch(editorActions.selectAllElements('laser')),
        onSelectElements: (elements) => dispatch(editorActions.selectElements('laser', elements)),
        onClearSelection: () => dispatch(editorActions.clearSelection('laser')),
        onMoveSelectedElementsByKey: () => dispatch(editorActions.moveElementsOnKeyUp('laser')),
        getSelectedElementsUniformScalingState: () => dispatch(editorActions.getSelectedElementsUniformScalingState('laser')),

        createText: (text) => dispatch(editorActions.createText('laser', text)),
        updateTextTransformationAfterEdit: (element, transformation) => dispatch(editorActions.updateModelTransformationByElement('laser', element, transformation)),

        uploadImage: (file, mode, onFailure, isLimit, fileInfo) => dispatch(editorActions.uploadImage('laser', file, mode, onFailure, isLimit, fileInfo)),
        checkIsOversizeImage: (file, onFailure) => dispatch(editorActions.checkIsOversizeImage('laser', file, onFailure)),
        cutModel: (file, onFailure) => dispatch(editorActions.cutModel('laser', file, onFailure)),
        switchToPage: (page) => dispatch(editorActions.switchToPage('laser', page)),

        onDrawLine: (line, closedLoop) => dispatch(editorActions.drawLine('laser', line, closedLoop)),
        onDrawDelete: (lines) => dispatch(editorActions.drawDelete('laser', lines)),
        onDrawTransform: (before, after) => dispatch(editorActions.drawTransform('laser', before, after)),
        onDrawTransformComplete: (elem, before, after) => dispatch(editorActions.drawTransformComplete('laser', elem, before, after)),
        onDrawStart: (elem) => dispatch(editorActions.drawStart('laser', elem)),
        onDrawComplete: (elem) => dispatch(editorActions.drawComplete('laser', elem)),
        onBoxSelect: (bbox, onlyContainSelect) => dispatch(editorActions.boxSelect('laser', bbox, onlyContainSelect)),
        setMode: (mode, ext) => dispatch(editorActions.setCanvasMode('laser', mode, ext)),
        updateEditorState: (state) => dispatch(editorActions.updateEditorState(state)),

        elementActions: {
            moveElementsStart: (elements) => dispatch(editorActions.moveElementsStart('laser', elements)),
            moveElements: (elements, options) => dispatch(editorActions.moveElements('laser', elements, options)),
            moveElementsFinish: (elements, options) => dispatch(editorActions.moveElementsFinish('laser', elements, options)),
            resizeElementsStart: (elements, options) => dispatch(editorActions.resizeElementsStart('laser', elements, options)),
            resizeElements: (elements, options) => dispatch(editorActions.resizeElements('laser', elements, options)),
            resizeElementsFinish: (elements, options) => dispatch(editorActions.resizeElementsFinish('laser', elements, options)),
            rotateElementsStart: (elements, options) => dispatch(editorActions.rotateElementsStart('laser', elements, options)),
            rotateElements: (elements, options) => dispatch(editorActions.rotateElements('laser', elements, options)),
            rotateElementsFinish: (elements, options) => dispatch(editorActions.rotateElementsFinish('laser', elements, options)),
            moveElementsOnKeyDown: (options) => dispatch(editorActions.moveElementsOnKeyDown('laser', null, options)),
            rotateElementsImmediately: (elements, options) => dispatch(editorActions.rotateElementsImmediately('laser', elements, options)),
            isPointInSelectArea: (x, y) => dispatch(editorActions.isPointInSelectArea('laser', x, y)),
            getMouseTargetByCoordinate: (x, y) => dispatch(editorActions.getMouseTargetByCoordinate('laser', x, y)),
            isSelectedAllVisible: () => dispatch(editorActions.isSelectedAllVisible('laser'))
        }
        // onModelTransform: () => dispatch(editorActions.onModelTransform('laser')),
        // onModelAfterTransform: () => dispatch(editorActions.onModelAfterTransform('laser'))
    };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(Visualizer));
