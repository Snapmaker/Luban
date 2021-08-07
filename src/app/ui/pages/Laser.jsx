import React, { useState, useEffect, useRef } from 'react';
import { shallowEqual, useSelector, useDispatch } from 'react-redux';
import path from 'path';
import PropTypes from 'prop-types';
import { useHistory, withRouter } from 'react-router-dom';
// import classNames from 'classnames';
import 'intro.js/introjs.css';
import { Steps } from 'intro.js-react';
import i18n from '../../lib/i18n';
// import Anchor from '../components/Anchor';
import Dropdown from '../components/Dropdown';
import Menu from '../components/Menu';
import SvgIcon from '../components/SvgIcon';
import modal from '../../lib/modal';
import LaserVisualizer from '../widgets/LaserVisualizer';
import Tabs from '../components/Tabs';

import { renderPopup, renderWidgetList, renderModal } from '../utils';
import Dropzone from '../components/Dropzone';
import { actions as editorActions } from '../../flux/editor';
import { actions as laserActions } from '../../flux/laser';
import { actions as projectActions } from '../../flux/project';
import ProjectLayout from '../layouts/ProjectLayout';
import MainToolBar from '../layouts/MainToolBar';
import { machineStore } from '../../store/local-storage';
// import WidgetContainer from '../Layouts/Widget';

import { HEAD_LASER, PAGE_EDITOR, PAGE_PROCESS, MACHINE_SERIES, PROCESS_MODE_GREYSCALE, PROCESS_MODE_VECTOR } from '../../constants';


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
import LaserCameraAidBackground from '../widgets/LaserCameraAidBackground';
import LaserTestFocusWidget from '../widgets/LaserTestFocus';
import CNCPathWidget from '../widgets/CNCPath';
import CncLaserOutputWidget from '../widgets/CncLaserOutput';

import PrintingMaterialWidget from '../widgets/PrintingMaterial';
import PrintingConfigurationsWidget from '../widgets/PrintingConfigurations';
import PrintingOutputWidget from '../widgets/PrintingOutput';
import WifiTransport from '../widgets/WifiTransport';
import EnclosureWidget from '../widgets/Enclosure';
import CncLaserObjectList from '../widgets/CncLaserList';
import JobType from '../widgets/JobType';
import PrintingVisualizer from '../widgets/PrintingVisualizer';
import HomePage from './HomePage';
import ToolPathListBox from '../widgets/CncLaserList/ToolPathList';
import Workspace from './Workspace';
import Thumbnail from '../widgets/CncLaserShared/Thumbnail';
import { laserCncIntroStepOne, laserCncIntroStepTwo, laserCncIntroStepFive, laserCncIntroStepSix, laser4AxisStepOne } from './introContent';

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
    'laser-test-focus': LaserTestFocusWidget,
    'cnc-path': CNCPathWidget,
    'cnc-output': CncLaserOutputWidget,
    'cnc-laser-object-list': CncLaserObjectList,
    'toolpath-list': ToolPathListBox
};

const ACCEPT = '.svg, .png, .jpg, .jpeg, .bmp, .dxf';
const pageHeadType = HEAD_LASER;


function useRenderMainToolBar(setShowHomePage, setShowJobType, setShowWorkspace, isRotate) {
    // (!workPosition.isFourAxis && (connectionType === CONNECTION_TYPE_WIFI && isConnected && !hasBackground))
    const isConnected = useSelector(state => state?.machine?.isConnected, shallowEqual);
    const series = useSelector(state => state?.machine?.series, shallowEqual);
    const canRedo = useSelector(state => state[HEAD_LASER]?.history?.canRedo, shallowEqual);
    const canUndo = useSelector(state => state[HEAD_LASER]?.history?.canUndo, shallowEqual);
    const [showCameraCapture, setShowCameraCapture] = useState(false);
    const dispatch = useDispatch();
    const menu = (
        <Menu style={{ marginTop: '8px' }}>
            <Menu.Item
                onClick={() => setShowCameraCapture(true)}
                disabled={series === MACHINE_SERIES.ORIGINAL?.value ? false : !isConnected}
            >
                <div className="align-l width-168">
                    <SvgIcon
                        type="static"
                        disabled={series === MACHINE_SERIES.ORIGINAL?.value ? false : !isConnected}
                        name="MainToolbarAddBackground"
                    />
                    <span
                        className="margin-left-4"
                    >
                        {i18n._('Add Background')}
                    </span>

                </div>
            </Menu.Item>
            <Menu.Item
                onClick={() => dispatch(laserActions.removeBackgroundImage())}
            >
                <div className="align-l width-168">
                    <SvgIcon
                        type="static"
                        name="MainToolbarRemoverBackground"
                    />
                    <span
                        className="margin-left-4"
                    >
                        {i18n._('Remove Background')}
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
            type: 'button',
            name: 'MainToolbarSave',
            iconClassName: 'laser-save-icon',
            action: () => {
                dispatch(projectActions.save(HEAD_LASER));
            }
        },
        {
            title: i18n._('Undo'),
            disabled: !canUndo,
            type: 'button',
            name: 'MainToolbarUndo',
            action: () => {
                dispatch(editorActions.undo(HEAD_LASER));
            }
        },
        {
            title: i18n._('Redo'),
            disabled: !canRedo,
            type: 'button',
            name: 'MainToolbarRedo',
            action: () => {
                dispatch(editorActions.redo(HEAD_LASER));
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
                dispatch(editorActions.bringSelectedModelToFront(HEAD_LASER));
            }
        },
        {
            title: i18n._('Bottom'),
            type: 'button',
            name: 'MainToolbarBottom',
            action: () => {
                dispatch(editorActions.sendSelectedModelToBack(HEAD_LASER));
            }
        }
    ];
    if (!isRotate) {
        leftItems.push(
            {
                type: 'separator'
            },
            {
                // MainToolbarCameraCapture
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
                                    name="MainToolbarCameraCapture"
                                >
                                    <div className="font-size-base color-black-3">
                                        {i18n._('Camera Capture')}
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

    const setBackgroundModal = showCameraCapture && renderModal({
        renderBody() {
            return (
                <div>
                    {series === MACHINE_SERIES.ORIGINAL?.value && (
                        <LaserSetBackground
                            hideModal={() => {
                                setShowCameraCapture(false);
                            }}
                        />
                    )}
                    {series !== MACHINE_SERIES.ORIGINAL?.value && (
                        <LaserCameraAidBackground
                            hideModal={() => {
                                setShowCameraCapture(false);
                            }}
                        />
                    )}
                </div>
            );
        },
        actions: [],
        onClose: () => { setShowCameraCapture(false); }
    });

    return {
        setBackgroundModal,
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
    const removingModelsWarning = useSelector(state => state?.laser?.removingModelsWarning);
    const emptyToolPaths = useSelector(state => state?.laser?.emptyToolPaths);
    const dispatch = useDispatch();
    const onClose = () => dispatch(editorActions.updateState(HEAD_LASER, {
        removingModelsWarning: false
    }));
    const returnModal = renderModal({
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
                    dispatch(editorActions.removeSelectedModel(HEAD_LASER));
                    dispatch(editorActions.removeEmptyToolPaths(HEAD_LASER));
                    onClose();
                }
            }
        ]
    });
    if (removingModelsWarning) {
        return returnModal;
    } else {
        return null;
    }
}
function Laser({ location }) {
    const widgets = useSelector(state => state?.widget[pageHeadType]?.default?.widgets, shallowEqual);
    const [isDraggingWidget, setIsDraggingWidget] = useState(false);
    const [showHomePage, setShowHomePage] = useState(false);
    const [showWorkspace, setShowWorkspace] = useState(false);
    const [showJobType, setShowJobType] = useState(true);
    const [enabledIntro, setEnabledIntro] = useState(null);
    const initIndex = 0;
    const coordinateMode = useSelector(state => state[HEAD_LASER]?.coordinateMode, shallowEqual);
    const coordinateSize = useSelector(state => state[HEAD_LASER]?.coordinateSize, shallowEqual);
    const toolPaths = useSelector(state => state[HEAD_LASER]?.toolPathGroup?.getToolPaths(), shallowEqual);
    const materials = useSelector(state => state[HEAD_LASER]?.materials, shallowEqual);
    const { isRotate } = materials;
    const [jobTypeState, setJobTypeState] = useState({
        coordinateMode,
        coordinateSize,
        materials
    });
    const dispatch = useDispatch();
    const page = useSelector(state => state?.laser?.page);
    const history = useHistory();
    const thumbnail = useRef();
    const modelGroup = useSelector(state => state[HEAD_LASER]?.modelGroup, shallowEqual);
    const toolPathGroup = useSelector(state => state[HEAD_LASER]?.toolPathGroup, shallowEqual);
    // const guideToursSetting = machineStore.get('guideTours');
    useEffect(() => {
        dispatch(laserActions.init());
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
            machineStore.set(isRotate ? 'guideTours.guideTourslaser4Axis' : 'guideTours.guideTourslaser', true); // mock   ---> true
        }
    }, [enabledIntro]);

    const { setBackgroundModal,
        renderMainToolBar } = useRenderMainToolBar(setShowHomePage, setShowJobType, setShowWorkspace, isRotate);
    const renderHomepage = () => {
        const onClose = () => setShowHomePage(false);
        return showHomePage && renderPopup({
            onClose,
            component: HomePage
        });
    };
    const jobTypeModal = showJobType && renderModal({
        title: i18n._('Job Setup'),
        renderBody() {
            return (
                <JobType
                    isWidget={false}
                    headType={HEAD_LASER}
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
                    dispatch(editorActions.changeCoordinateMode(HEAD_LASER,
                        jobTypeState.coordinateMode, jobTypeState.coordinateSize));
                    dispatch(editorActions.updateMaterials(HEAD_LASER, jobTypeState.materials));
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
    const warningRemovingModels = useRenderRemoveModelsWarning();
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
            let mode = PROCESS_MODE_GREYSCALE;
            if (path.extname(file.name).toLowerCase() === '.svg' || path.extname(file.name).toLowerCase() === '.dxf') {
                mode = PROCESS_MODE_VECTOR;
            }
            dispatch(editorActions.uploadImage('laser', file, mode, () => {
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
        const widgetProps = { headType: 'laser' };
        return (
            <div className="laser-intro-edit-panel">
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
                        dispatch(editorActions.switchToPage(HEAD_LASER, key));
                        if (key === PAGE_EDITOR) {
                            dispatch(editorActions.showModelGroupObject(HEAD_LASER));
                        }
                    }}
                />
                {renderWidgetList('laser', 'default', widgets, allWidgets, listActions, widgetProps)}
                <CncLaserOutputWidget
                    headType={HEAD_LASER}
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

    function handleExit() {
        // machineStore.set(isRotate ? 'guideTours.guideTourslaser4Axis' : 'guideTours.guideTourslaser', true); // mock   ---> true
        setEnabledIntro(false);
    }

    function handleChange(nextIndex) {
        if (nextIndex === 1) {
            let pathConfig = {};
            if (isRotate) {
                pathConfig = {
                    path: './UserCase/A250/A250_4th_Laser.snaplzr',
                    name: 'A250_4th_Laser.snaplzr'
                };
            } else {
                pathConfig = {
                    path: './UserCase/A150/A150_Laser.snaplzr',
                    name: 'A150_Laser.snaplzr'
                };
            }
            dispatch(projectActions.openProject(pathConfig, history, true));
        }
    }
    async function handleBeforeChange(nextIndex) {
        if (nextIndex === 4) {
            dispatch(editorActions.switchToPage(HEAD_LASER, 'process'));
            dispatch(editorActions.selectToolPathId(HEAD_LASER, toolPaths[0].id));
        } else if (nextIndex === 6) {
            const thumbnailRef = thumbnail.current.getThumbnail();
            await dispatch(editorActions.preview(HEAD_LASER));
            await dispatch(editorActions.commitGenerateGcode(HEAD_LASER, thumbnailRef));
        }
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
                    <LaserVisualizer
                        widgetId="laserVisualizer"
                    />
                    <Steps
                        enabled={enabledIntro}
                        initialStep={initIndex}
                        onChange={handleChange}
                        onBeforeChange={handleBeforeChange}
                        options={{
                            showBullets: false,
                            nextLabel: i18n._('Next'),
                            doneLabel: i18n._('Complete'),
                            hidePrev: false,
                            exitOnEsc: false,
                            exitOnOverlayClick: false
                        }}
                        steps={[{
                            intro: isRotate ? laser4AxisStepOne(
                                i18n._('Set the work size and where the work origin will be.'),
                                i18n._('D is the diameter of the material,  and L is the length of the material.'),
                                i18n._('Origin is fixed at the edge of the cross-section of the cylinder, far way from the chuck.')
                            ) : laserCncIntroStepOne(
                                i18n._('Set the work size and where the work origin will be.'),
                                i18n._('X is the width of the material,  and Y is the height of the material.'),
                                i18n._('Origin can be set at any corner or the middle of the job. This point (X0, Y0) is the origin of the design coordinate system. It also represents the origin of the workpiece coordinate system that you should set on the material using the machine tool.')
                            ),
                            title: `${i18n._('Job Setup')} (1/8)`
                        }, {
                            element: '.laser-tool-bar-open-icon',
                            title: `${i18n._('Import Object')} (2/8)`,
                            intro: laserCncIntroStepTwo(i18n._('Import an object, or drag an object to Luban.')),
                            disableInteraction: true,
                            tooltipClass: 'laser-import-intro',
                            position: 'right'
                        }, {
                            element: '.laser-draw-intro-part',
                            title: `${i18n._('Draw Object')} (3/8)`,
                            intro: laserCncIntroStepTwo(i18n._('Alternatively, you can draw simple objects or add text for laser engrave or CNC carve.')),
                            disableInteraction: true,
                            tooltipClass: 'laser-draw-intro',
                            position: 'right'
                        }, {
                            // element: '.laser-intro-edit-panel',
                            element: '.widget-list-intro',
                            title: `${i18n._('Edit Panel')} (4/8)`,
                            intro: laserCncIntroStepTwo(i18n._('The Edit panel shows the property related to object. When an object is selected, Luban displays this panel where you can transform the object, switch the Processing Mode, or enter the Process Panel.')),
                            disableInteraction: true,
                            tooltipClass: 'laser-edit-panel-intro',
                            position: 'left'
                        }, {
                            element: '.laser-widget-list-intro',
                            title: `${i18n._('Process Panel')} (5/8)`,
                            intro: laserCncIntroStepFive(
                                i18n._('The Process panel shows the Toolpath List and the relevant property of the toolpath.'),
                                i18n._('After the selected object is edited, you can create, edit, and sort the toolpaths of the object. Below the Toolpath List are the parameters you often use.'),
                                i18n._('Create Toolpath')
                            ),
                            disableInteraction: true,
                            position: 'left'
                        }, {
                            element: '.laser-preview-export-intro-part',
                            title: `${i18n._('Generate G-code and Preview')} (6/8)`,
                            position: 'top',
                            disableInteraction: true,
                            intro: laserCncIntroStepSix(
                                i18n._('Click to generate and preview the G-code file.'),
                                i18n._('For laser engraving, you can preview the toolpath. For CNC carving, you can preview the toolpath and simulate the operation result.')
                            )
                        }, {
                            element: '.laser-preview-export-intro-part',
                            title: `${i18n._('Export')} (7/8)`,
                            position: 'top',
                            disableInteraction: true,
                            intro: laserCncIntroStepTwo(
                                i18n._('Export the G-code file to a local device or load it to Workspace. Use Touchscreen or Luban to start laser engraving or CNC carving.')
                            )
                        }, {
                            element: '.laser-save-icon',
                            title: `${i18n._('Save Project')} (8/8)`,
                            position: 'bottom',
                            disableInteraction: true,
                            intro: laserCncIntroStepTwo(i18n._('Save the project to a local device for reuse.'))
                        }]}
                        onExit={handleExit}
                    />
                </Dropzone>
                <Thumbnail
                    ref={thumbnail}
                    toolPathGroup={toolPathGroup}
                    modelGroup={modelGroup}
                />
            </ProjectLayout>
            {warningRemovingModels}
            {jobTypeModal}
            {setBackgroundModal}
            {renderHomepage()}
            {renderWorkspace()}
        </div>
    );
}
Laser.propTypes = {
    // history: PropTypes.object
    location: PropTypes.object
};
export default withRouter(Laser);
