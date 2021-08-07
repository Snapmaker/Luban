import React, { useState, useEffect, useRef } from 'react';

import { shallowEqual, useSelector, useDispatch } from 'react-redux';
import PropTypes from 'prop-types';
import { useHistory, withRouter } from 'react-router-dom';
import path from 'path';
import { Trans } from 'react-i18next';
import 'intro.js/introjs.css';
import { Steps } from 'intro.js-react';
import Dropdown from '../components/Dropdown';
import Menu from '../components/Menu';
import i18n from '../../lib/i18n';
import modal from '../../lib/modal';
import Dropzone from '../components/Dropzone';
import SvgIcon from '../components/SvgIcon';
import Space from '../components/Space';
import { renderModal, renderPopup, renderWidgetList } from '../utils';
import Tabs from '../components/Tabs';
import Checkbox from '../components/Checkbox';
import { Button } from '../components/Buttons';
import Cnc3DVisualizer from '../views/Cnc3DVisualizer';

import CNCVisualizer from '../widgets/CNCVisualizer';
import ProjectLayout from '../layouts/ProjectLayout';
import MainToolBar from '../layouts/MainToolBar';

import { actions as projectActions } from '../../flux/project';
import { actions as cncActions } from '../../flux/cnc';
import { actions as editorActions } from '../../flux/editor';

import { actions as machineActions } from '../../flux/machine';

import {
    PROCESS_MODE_GREYSCALE,
    PROCESS_MODE_MESH,
    PROCESS_MODE_VECTOR,
    PAGE_EDITOR,
    PAGE_PROCESS,
    HEAD_CNC
} from '../../constants';

import ControlWidget from '../widgets/Control';
import ConnectionWidget from '../widgets/Connection';
import ConsoleWidget from '../widgets/Console';
import GCodeWidget from '../widgets/GCode';
import MacroWidget from '../widgets/Macro';
import PurifierWidget from '../widgets/Purifier';
import MarlinWidget from '../widgets/Marlin';
import VisualizerWidget from '../widgets/WorkspaceVisualizer';
import WebcamWidget from '../widgets/Webcam';
import LaserParamsWidget from '../widgets/LaserParams';
import LaserSetBackground from '../widgets/LaserSetBackground';
import LaserTestFocusWidget from '../widgets/LaserTestFocus';
import CNCPathWidget from '../widgets/CNCPath';
import CncLaserOutputWidget from '../widgets/CncLaserOutput';

import PrintingMaterialWidget from '../widgets/PrintingMaterial';
import PrintingConfigurationsWidget from '../widgets/PrintingConfigurations';
import PrintingOutputWidget from '../widgets/PrintingOutput';
import WifiTransport from '../widgets/WifiTransport';
import EnclosureWidget from '../widgets/Enclosure';
import JobType from '../widgets/JobType';
import ToolPathListBox from '../widgets/CncLaserList/ToolPathList';
import PrintingVisualizer from '../widgets/PrintingVisualizer';
import HomePage from './HomePage';
// import Anchor from '../components/Anchor';
import Workspace from './Workspace';
import { machineStore } from '../../store/local-storage';
import Thumbnail from '../widgets/CncLaserShared/Thumbnail';
import { laserCncIntroStepOne, laserCncIntroStepTwo, laserCncIntroStepFive, laserCncIntroStepSix, cnc4AxisStepOne } from './introContent';

const allWidgets = {
    'control': ControlWidget,
    // 'axesPanel': DevelopAxesWidget,
    'connection': ConnectionWidget,
    'console': ConsoleWidget,
    'gcode': GCodeWidget,
    'macro': MacroWidget,
    'macroPanel': MacroWidget,
    'purifier': PurifierWidget,
    'marlin': MarlinWidget,
    'visualizer': VisualizerWidget,
    'webcam': WebcamWidget,
    'printing-visualizer': PrintingVisualizer,
    'wifi-transport': WifiTransport,
    'enclosure': EnclosureWidget,
    '3dp-material': PrintingMaterialWidget,
    '3dp-configurations': PrintingConfigurationsWidget,
    '3dp-output': PrintingOutputWidget,
    'laser-params': LaserParamsWidget,
    // 'laser-output': CncLaserOutputWidget,
    'laser-set-background': LaserSetBackground,
    'laser-test-focus': LaserTestFocusWidget,
    'cnc-path': CNCPathWidget,
    // 'cnc-output': CncLaserOutputWidget,
    'toolpath-list': ToolPathListBox
};


const ACCEPT = '.svg, .png, .jpg, .jpeg, .bmp, .dxf, .stl';
const pageHeadType = HEAD_CNC;
function useRenderWarning() {
    const [showWarning, setShowWarning] = useState(false);
    const dispatch = useDispatch();

    const onClose = () => setShowWarning(false);

    function onChangeShouldShowWarning(value) {
        dispatch(machineActions.setShouldShowCncWarning(value));
    }

    return showWarning && renderModal({
        onClose,
        renderBody: () => (
            <div style={{ width: '432px' }}>
                <SvgIcon
                    color="#FFA940"
                    type="static"
                    className="display-block width-72 margin-auto"
                    name="WarningTipsWarning"
                    size="72"
                />
                <div className="align-c font-weight-bold margin-bottom-16">
                    {i18n._('Warning')}
                </div>
                <div>
                    <Trans i18nKey="key_CNC_loading_warning">
                                This is an alpha feature that helps you get started with CNC Carving. Make sure you
                        <Space width={4} />
                        <a
                            style={{ color: '#28a7e1' }}
                            href="https://manual.snapmaker.com/cnc_carving/read_this_first_-_safety_information.html"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                                    Read This First - Safety Information
                        </a>
                        <Space width={4} />
                                before proceeding.
                    </Trans>
                </div>
            </div>
        ),
        renderFooter: () => (
            <div className="sm-flex justify-space-between">
                <div className="display-inline height-32">
                    <Checkbox
                        id="footer-input"
                        defaultChecked={false}
                        onChange={onChangeShouldShowWarning}
                    />
                    <span className="margin-left-4">{i18n._('Don\'t show again')}</span>
                </div>
                <Button
                    type="default"
                    width="96px"
                    priority="level-two"
                    onClick={onClose}
                >
                    {i18n._('Cancel')}
                </Button>
            </div>
        )
    });
}
function useRenderMainToolBar(setShowHomePage, setShowJobType, setShowWorkspace) {
    // const unSaved = useSelector(state => state?.project[HEAD_CNC]?.unSaved, shallowEqual);
    // const hasModel = useSelector(state => state[HEAD_CNC]?.hasModel, shallowEqual);
    const canRedo = useSelector(state => state[HEAD_CNC]?.history?.canRedo, shallowEqual);
    const canUndo = useSelector(state => state[HEAD_CNC]?.history?.canUndo, shallowEqual);
    const isRotate = useSelector(state => state[HEAD_CNC]?.materials?.isRotate, shallowEqual);
    const [showStlModal, setShowStlModal] = useState(true);
    const dispatch = useDispatch();
    function handleHideStlModal() {
        setShowStlModal(false);
    }
    function handleShowStlModal() {
        setShowStlModal(true);
    }
    const menu = (
        <Menu style={{ marginTop: '8px' }}>
            <Menu.Item
                onClick={handleShowStlModal}
                disabled={showStlModal}
            >
                <div className="align-l width-168">
                    <SvgIcon
                        type="static"
                        disabled={showStlModal}
                        name="MainToolbarAddBackground"
                    />
                    <span
                        className="margin-left-4"
                    >
                        {i18n._('Enable STL 3D View')}
                    </span>

                </div>
            </Menu.Item>
            <Menu.Item
                onClick={handleHideStlModal}
                disabled={!showStlModal}
            >
                <div className="align-l width-168">
                    <SvgIcon
                        type="static"
                        disabled={!showStlModal}
                        name="MainToolbarRemoverBackground"
                    />
                    <span
                        className="margin-left-4"
                    >
                        {i18n._('Disable STL 3D View')}
                    </span>
                </div>
            </Menu.Item>
        </Menu>
    );
    const leftItems = [
        {
            title: i18n._('Home'),
            type: 'button',
            name: 'MainToolbarHome',
            action: () => {
                setShowHomePage(true);
                window.scrollTo(0, 0);
            }
        },
        {
            title: i18n._('Workspace'),
            type: 'button',
            name: 'MainToolbarWorkspace',
            action: () => {
                setShowWorkspace(true);
            }
        },
        {
            type: 'separator'
        },
        {
            title: i18n._('Save'),
            // disabled: !hasModel,
            type: 'button',
            name: 'MainToolbarSave',
            iconClassName: 'cnc-save-icon',
            action: () => {
                dispatch(projectActions.save(HEAD_CNC));
            }
        },
        {
            title: i18n._('Undo'),
            disabled: !canUndo,
            type: 'button',
            name: 'MainToolbarUndo',
            action: () => {
                dispatch(editorActions.undo(HEAD_CNC));
            }
        },
        {
            title: i18n._('Redo'),
            disabled: !canRedo,
            type: 'button',
            name: 'MainToolbarRedo',
            action: () => {
                dispatch(editorActions.redo(HEAD_CNC));
            }
        },
        {
            title: i18n._('Job Setup'),
            type: 'button',
            name: 'MainToolbarJobSetup',
            action: () => {
                setShowJobType(true);
            }
        },
        {
            type: 'separator'
        },
        {
            title: i18n._('Top'),
            type: 'button',
            name: 'MainToolbarTop',
            action: () => {
                dispatch(editorActions.bringSelectedModelToFront(HEAD_CNC));
            }
        },
        {
            title: i18n._('Bottom'),
            type: 'button',
            name: 'MainToolbarBottom',
            action: () => {
                dispatch(editorActions.sendSelectedModelToBack(HEAD_CNC));
            }
        }

    ];
    if (isRotate) {
        leftItems.push(
            {
                type: 'render',
                customRender: function () {
                    return (
                        <Dropdown
                            className="display-inline align-c padding-top-4 padding-horizontal-2"
                            overlay={menu}
                        >
                            <div
                                className="display-inline font-size-0 v-align-t"
                            >
                                <SvgIcon
                                    name="MainToolbarStl3dView"
                                >
                                    <div className="font-size-base color-black-3">
                                        {i18n._('STL 3D View')}
                                        <SvgIcon
                                            type="static"
                                            name="DropdownLine"
                                        />
                                    </div>
                                </SvgIcon>
                            </div>
                        </Dropdown>
                    );
                }
            }
        );
    }
    return {
        renderStlModal: () => {
            return (
                <Cnc3DVisualizer show={showStlModal} />
            );
        },
        renderMainToolBar: () => {
            return (
                <MainToolBar
                    leftItems={leftItems}
                />
            );
        }
    };
}

function useRenderRemoveModelsWarning() {
    const removingModelsWarning = useSelector(state => state?.cnc?.removingModelsWarning);
    const emptyToolPaths = useSelector(state => state?.cnc?.emptyToolPaths);
    const dispatch = useDispatch();
    const onClose = () => dispatch(editorActions.updateState(HEAD_CNC, {
        removingModelsWarning: false
    }));
    return removingModelsWarning && renderModal({
        onClose,
        renderBody: () => (
            <div>
                <div>{i18n._('Remove all empty toolPath(s)?')}</div>
                {emptyToolPaths.map((item) => {
                    return (<div key={item.name}>{item.name}</div>);
                })}
            </div>
        ),
        actions: [
            {
                name: i18n._('Cancel'),
                onClick: () => { onClose(); }
            },
            {
                name: i18n._('Yes'),
                isPrimary: true,
                onClick: () => {
                    dispatch(editorActions.removeSelectedModel(HEAD_CNC));
                    dispatch(editorActions.removeEmptyToolPaths(HEAD_CNC));
                    onClose();
                }
            }
        ]
    });
}
function Cnc({ location }) {
    const widgets = useSelector(state => state?.widget[pageHeadType]?.default?.widgets, shallowEqual);
    const [isDraggingWidget, setIsDraggingWidget] = useState(false);
    const [showHomePage, setShowHomePage] = useState(false);
    const [showWorkspace, setShowWorkspace] = useState(false);
    const [showJobType, setShowJobType] = useState(true);
    const [enabledIntro, setEnabledIntro] = useState(null);
    const initIndex = 0;
    const toolPaths = useSelector(state => state[HEAD_CNC]?.toolPathGroup?.getToolPaths(), shallowEqual);
    const modelGroup = useSelector(state => state[HEAD_CNC]?.modelGroup, shallowEqual);
    const toolPathGroup = useSelector(state => state[HEAD_CNC]?.toolPathGroup, shallowEqual);
    const coordinateMode = useSelector(state => state[HEAD_CNC]?.coordinateMode, shallowEqual);
    const coordinateSize = useSelector(state => state[HEAD_CNC]?.coordinateSize, shallowEqual);
    const materials = useSelector(state => state[HEAD_CNC]?.materials, shallowEqual);
    const [jobTypeState, setJobTypeState] = useState({
        coordinateMode,
        coordinateSize,
        materials
    });
    const { isRotate } = materials;
    const dispatch = useDispatch();
    const history = useHistory();
    const page = useSelector(state => state?.cnc.page);
    const thumbnail = useRef();

    useEffect(() => {
        // const setting = machineStore.get('guideTours');
        // if (!setting?.guideTourscnc) {
        //     setEnabledIntro(true);
        // } else {
        //     setEnabledIntro(false);
        // }
        dispatch(cncActions.init());
    }, []);

    useEffect(() => {
        setJobTypeState({
            coordinateMode,
            coordinateSize,
            materials
        });
    }, [coordinateMode, coordinateSize, materials]);

    useEffect(() => {
        if (location?.state?.shouldShowJobType) {
            setShowJobType(true);
        } else {
            setShowJobType(false);
        }
        if (location?.state?.shouldShowGuideTours) {
            setEnabledIntro(true);
        } else {
            setEnabledIntro(false);
        }
    }, [location?.state?.shouldShowJobType, location?.state?.shouldShowGuideTours]);

    useEffect(() => {
        if (typeof (enabledIntro) === 'boolean' && !enabledIntro) {
            machineStore.set(isRotate ? 'guideTours.guideTourscnc4Axis' : 'guideTours.guideTourscnc', true); // mock   ---> true
        }
    }, [enabledIntro]);

    const { renderStlModal, renderMainToolBar } = useRenderMainToolBar(
        setShowHomePage,
        setShowJobType,
        setShowWorkspace
    );

    const renderHomepage = () => {
        const onClose = () => setShowHomePage(false);
        return showHomePage && renderPopup({
            onClose,
            component: HomePage
        });
    };
    const jobTypeModal = (showJobType) && renderModal({
        title: i18n._('Job Setup'),
        renderBody() {
            return (
                <JobType
                    isWidget={false}
                    headType={HEAD_CNC}
                    jobTypeState={jobTypeState}
                    setJobTypeState={setJobTypeState}
                />
            );
        },
        actions: [
            {
                name: i18n._('Cancel'),
                onClick: () => {
                    setJobTypeState({
                        coordinateMode,
                        coordinateSize,
                        materials
                    });
                    setShowJobType(false);
                }
            },
            {
                name: i18n._('Save'),
                isPrimary: true,
                onClick: () => {
                    dispatch(editorActions.changeCoordinateMode(HEAD_CNC,
                        jobTypeState.coordinateMode, jobTypeState.coordinateSize));
                    dispatch(editorActions.updateMaterials(HEAD_CNC, jobTypeState.materials));
                    setShowJobType(false);
                }
            }
        ],
        onClose: () => {
            setJobTypeState({
                coordinateMode,
                coordinateSize,
                materials
            });
            setShowJobType(false);
        }
    });
    const warningModal = useRenderWarning();
    const removeModelsWarningModal = useRenderRemoveModelsWarning();
    const listActions = {
        onDragStart: () => {
            setIsDraggingWidget(true);
        },
        onDragEnd: () => {
            setIsDraggingWidget(false);
        }
    };

    const actions = {
        onDropAccepted: (file) => {
            const extname = path.extname(file.name).toLowerCase();
            let uploadMode;
            if (extname.toLowerCase() === '.svg') {
                uploadMode = PROCESS_MODE_VECTOR;
            } else if (extname.toLowerCase() === '.dxf') {
                uploadMode = PROCESS_MODE_VECTOR;
            } else if (extname.toLowerCase() === '.stl') {
                uploadMode = PROCESS_MODE_MESH;
            } else {
                uploadMode = PROCESS_MODE_GREYSCALE;
            }
            dispatch(editorActions.uploadImage('cnc', file, uploadMode, () => {
                modal({
                    title: i18n._('Parse Error'),
                    body: i18n._('Failed to parse image file {{filename}}.', { filename: file.name })
                });
            }));
        },
        onDropRejected: () => {
            modal({
                title: i18n._('Warning'),
                cancelTitle: 'Close',
                body: i18n._('Only {{accept}} files are supported.', { accept: ACCEPT })
            });
        }
    };

    function renderRightView() {
        const widgetProps = { headType: 'cnc' };
        return (
            <div>
                <Tabs
                    options={[
                        {
                            tab: i18n._('Edit'),
                            key: PAGE_EDITOR
                        },
                        {
                            tab: i18n._('Process'),
                            key: PAGE_PROCESS
                        }
                    ]}
                    activeKey={page}
                    onChange={(key) => {
                        dispatch(editorActions.switchToPage(HEAD_CNC, key));
                        if (key === PAGE_EDITOR) {
                            dispatch(editorActions.showModelGroupObject(HEAD_CNC));
                        }
                    }}
                />
                {renderWidgetList('cnc', 'default', widgets, allWidgets, listActions, widgetProps)}
                <CncLaserOutputWidget
                    headType={HEAD_CNC}
                />
            </div>
        );
    }
    function renderWorkspace() {
        const onClose = () => setShowWorkspace(false);
        return showWorkspace && renderPopup({
            onClose,
            component: Workspace
        });
    }

    function handleChange(nextIndex) {
        if (nextIndex === 1) {
            let pathConfig = {};
            if (isRotate) {
                pathConfig = {
                    path: './UserCase/A250/4th_CNC.snapcnc',
                    name: '4th_CNC.snapcnc'
                };
            } else {
                pathConfig = {
                    path: './UserCase/A150/A150_CNC.snapcnc',
                    name: 'A150_CNC.snapcnc'
                };
            }
            dispatch(projectActions.openProject(pathConfig, history, true));
        }
    }
    async function handleBeforeChange(nextIndex) {
        if (nextIndex === 4) {
            dispatch(editorActions.switchToPage(HEAD_CNC, 'process'));
            dispatch(editorActions.selectToolPathId(HEAD_CNC, toolPaths[0].id));
        } else if (nextIndex === 6) {
            const thumbnailRef = thumbnail.current.getThumbnail();
            await dispatch(editorActions.preview(HEAD_CNC));
            await dispatch(editorActions.commitGenerateGcode(HEAD_CNC, thumbnailRef));
        }
    }
    function handleExit() {
        // machineStore.set('guideTours.guideTourscnc', true); // mock   ---> true
        setEnabledIntro(false);
    }
    return (
        <div>
            <ProjectLayout
                renderMainToolBar={renderMainToolBar}
                renderRightView={renderRightView}
            >
                <Dropzone
                    disabled={isDraggingWidget}
                    accept={ACCEPT}
                    dragEnterMsg={i18n._('Drop an image file here.')}
                    onDropAccepted={actions.onDropAccepted}
                    onDropRejected={actions.onDropRejected}
                >
                    <CNCVisualizer />
                    <Steps
                        options={{
                            showBullets: false,
                            nextLabel: i18n._('Next'),
                            doneLabel: i18n._('Complete')
                        }}
                        enabled={enabledIntro}
                        initialStep={initIndex}
                        onChange={handleChange}
                        onBeforeChange={handleBeforeChange}
                        onExit={handleExit}
                        steps={[
                            {
                                intro: isRotate ? cnc4AxisStepOne(
                                    i18n._('Set the work size and where the work origin will be.'),
                                    i18n._('D is the diameter of the material,  and L is the length of the material.'),
                                    i18n._('Origin is fixed at the center of the cross-section of the cylinder, far way from the chuck.')
                                ) : laserCncIntroStepOne(
                                    i18n._('Set the work size and where the work origin will be.'),
                                    i18n._('X is the width of the material,  and Y is the height of the material.'),
                                    i18n._('Origin can be set at any corner or the middle of the job. This point (X0, Y0) is the origin of the design coordinate system. It also represents the origin of the workpiece coordinate system that you should set on the material using the machine tool.')
                                ),
                                title: `${i18n._('Job Setup')} (1/8)`
                            }, {
                                element: '.cnc-tool-bar-open-icon',
                                title: `${i18n._('Import Object')} (2/8)`,
                                intro: laserCncIntroStepTwo(i18n._('Import an object, or drag an object to Luban.')),
                                disableInteraction: true,
                                tooltipClass: 'cnc-import-intro',
                                position: 'right'
                            }, {
                                element: '.cnc-draw-intro-part',
                                title: `${i18n._('Draw Object')} (3/8)`,
                                intro: laserCncIntroStepTwo(i18n._('Alternatively, you can draw simple objects or add text for laser engrave or CNC carve.')),
                                disableInteraction: true,
                                tooltipClass: 'cnc-draw-intro',
                                position: 'right'
                            }, {
                                // element: '.laser-intro-edit-panel',
                                element: '.widget-list-intro',
                                title: `${i18n._('Edit Panel')} (4/8)`,
                                intro: laserCncIntroStepTwo(i18n._('The Edit panel shows the property related to object. When an object is selected, Luban displays this panel where you can transform the object, switch the Processing Mode, or enter the Process Panel.')),
                                disableInteraction: true,
                                tooltipClass: 'cnc-edit-panel-intro',
                                position: 'left'
                            }, {
                                element: '.cnc-widget-list-intro',
                                title: `${i18n._('Process Panel')} (5/8)`,
                                intro: laserCncIntroStepFive(
                                    i18n._('The Process panel shows the Toolpath List and the relevant property of the toolpath.'),
                                    i18n._('After the selected object is edited, you can create, edit, and sort the toolpaths of the object. Below the Toolpath List are the parameters you often use.'),
                                    i18n._('Create Toolpath')
                                ),
                                disableInteraction: true,
                                position: 'left'
                            }, {
                                element: '.cnc-preview-export-intro-part',
                                title: `${i18n._('Generate G-code and Preview')} (6/8)`,
                                position: 'top',
                                disableInteraction: true,
                                intro: laserCncIntroStepSix(
                                    i18n._('Click to generate and preview the G-code file.'),
                                    i18n._('For laser engraving, you can preview the toolpath. For CNC carving, you can preview the toolpath and simulate the operation result.')
                                )
                            }, {
                                element: '.cnc-preview-export-intro-part',
                                title: `${i18n._('Export')} (7/8)`,
                                position: 'top',
                                disableInteraction: true,
                                intro: laserCncIntroStepTwo(
                                    i18n._('Export the G-code file to a local device or load it to Workspace. Use Touchscreen or Luban to start laser engraving or CNC carving.')
                                )
                            }, {
                                element: '.cnc-save-icon',
                                title: `${i18n._('Save Project')} (8/8)`,
                                position: 'bottom',
                                disableInteraction: true,
                                intro: laserCncIntroStepTwo(i18n._('Save the project to a local device for reuse.'))
                            }
                        ]}
                    />
                </Dropzone>
                <Thumbnail
                    ref={thumbnail}
                    toolPathGroup={toolPathGroup}
                    modelGroup={modelGroup}
                />
            </ProjectLayout>
            {warningModal}
            {removeModelsWarningModal}
            {jobTypeModal}
            {renderStlModal()}
            {renderHomepage()}
            {renderWorkspace()}
        </div>
    );
}
Cnc.propTypes = {
    // ...withRouter,
    // shouldShowJobType: PropTypes.bool,
    location: PropTypes.object
};
export default withRouter(Cnc);
